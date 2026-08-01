import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobMatches, jobs } from "@/db/schema";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import { JOB_MATCH_PROMPT_VERSION, loadPrompt } from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { assertPublicBudgetAllows } from "@/lib/budgets";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { getApprovedProfile } from "@/modules/profile/queries";
import type { JobSearchParams } from "@/modules/search-profile/schemas";

export const JobMatchResultSchema = z.object({
  matchScore: z.number().min(0).max(100),
  eligibility: z.enum(["eligible", "borderline", "ineligible"]),
  recommend: z.boolean(),
  recommendation: z.enum(["apply", "consider", "skip"]).optional(),
  matchingReasons: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  missingRequirements: z.array(z.string()).default([]),
  mainRisk: z.string().optional(),
});

export type JobMatchResult = z.infer<typeof JobMatchResultSchema>;

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

function normalizeRecommendation(r: JobMatchResult): JobMatchResult {
  let recommendation = r.recommendation;
  if (!recommendation) {
    if (!r.recommend || r.eligibility === "ineligible") recommendation = "skip";
    else if (r.matchScore >= 80 && r.eligibility === "eligible")
      recommendation = "apply";
    else recommendation = "consider";
  }
  if (r.eligibility === "ineligible" || !r.recommend) {
    recommendation = "skip";
  }
  return { ...r, recommendation, recommend: recommendation !== "skip" };
}

async function evaluateOne(
  jobRow: typeof jobs.$inferSelect,
  profileJson: string,
  searchParams: JobSearchParams,
): Promise<{ result: JobMatchResult; model: string; costUsd: number }> {
  assertPublicBudgetAllows("jobMatch");
  const system = loadPrompt("jobs/match-and-explain.md");
  const model = resolveModel("jobMatch");
  const user = JSON.stringify(
    {
      profile: JSON.parse(profileJson),
      searchHints: {
        targetTitles: searchParams.targetTitles,
        excludedTitles: searchParams.excludedTitles,
        locations: searchParams.locations,
        remoteRequired: searchParams.remoteRequired,
      },
      job: {
        title: jobRow.title,
        companyLocation: jobRow.location,
        remotePolicy: jobRow.remotePolicy,
        employmentType: jobRow.employmentType,
        salaryText: jobRow.salaryText,
        postedAt: jobRow.postedAt,
        source: jobRow.source,
        description: jobRow.description.slice(0, 6000),
      },
    },
    null,
    2,
  );

  const tryOnce = async () => {
    const completion = await googleProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "jobMatch",
      temperature: 0.2,
      jsonMode: true,
    });
    const parsed = normalizeRecommendation(
      JobMatchResultSchema.parse(parseJsonLoose(completion.text)),
    );
    return {
      result: parsed,
      model,
      costUsd: completion.estimatedCost ?? 0,
    };
  };

  try {
    return await tryOnce();
  } catch (err) {
    logger.warn({ err, jobId: jobRow.id }, "job match parse failed — retry");
    return await tryOnce();
  }
}

export async function evaluateJobsBatch(options: {
  jobIds: string[];
  profileVersion: number;
  searchProfileVersion: number;
  searchParams: JobSearchParams;
  profileJson: string;
}): Promise<{ evaluated: number; recommended: number }> {
  const db = getDb();
  let evaluated = 0;
  let recommended = 0;

  for (const jobId of options.jobIds) {
    const existing = db
      .select()
      .from(jobMatches)
      .where(
        and(
          eq(jobMatches.jobId, jobId),
          eq(jobMatches.profileVersion, options.profileVersion),
          eq(jobMatches.promptVersion, JOB_MATCH_PROMPT_VERSION),
        ),
      )
      .get();
    if (existing) {
      evaluated++;
      if (existing.recommend) recommended++;
      continue;
    }

    const jobRow = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
    if (!jobRow) continue;

    try {
      const { result, model, costUsd } = await evaluateOne(
        jobRow,
        options.profileJson,
        options.searchParams,
      );

      db.insert(jobMatches)
        .values({
          id: newId("jmatch"),
          jobId,
          profileVersion: options.profileVersion,
          searchProfileVersion: options.searchProfileVersion,
          matchScore: Math.round(result.matchScore),
          eligibility: result.eligibility,
          recommend: result.recommend ? 1 : 0,
          recommendation: result.recommendation ?? "skip",
          matchingReasonsJson: JSON.stringify(result.matchingReasons),
          concernsJson: JSON.stringify(result.concerns),
          scoreJson: JSON.stringify(result),
          modelId: model,
          promptVersion: JOB_MATCH_PROMPT_VERSION,
          costUsd,
          createdAt: nowIso(),
        })
        .run();

      evaluated++;
      if (result.recommend && result.eligibility !== "ineligible") recommended++;
    } catch (err) {
      logger.warn({ err, jobId }, "job evaluate failed");
    }
  }

  return { evaluated, recommended };
}

export type RankedJob = {
  jobId: string;
  matchScore: number;
  eligibility: string;
  recommendation: string;
  matchingReasons: string[];
  concerns: string[];
  postedAt: string | null;
};

/**
 * Rank survivors for daily publish. Quality floor — never pad.
 */
export function rankJobsForPublish(options: {
  minScore?: number;
  limit: number;
}): RankedJob[] {
  const minScore = options.minScore ?? 70;
  const db = getDb();
  const active = db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "active"))
    .all()
    .filter(
      (j) =>
        j.triageState === "discovered" ||
        j.triageState === "published" ||
        j.triageState === "saved",
    );

  const ranked: RankedJob[] = [];
  for (const job of active) {
    if (
      job.triageState === "rejected" ||
      job.triageState === "interested" ||
      job.triageState === "applied"
    ) {
      continue;
    }
    const match = db
      .select()
      .from(jobMatches)
      .where(eq(jobMatches.jobId, job.id))
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!match) continue;
    if (!match.recommend) continue;
    if (match.eligibility === "ineligible") continue;
    if (match.matchScore < minScore) continue;

    let reasons: string[] = [];
    let concerns: string[] = [];
    try {
      reasons = JSON.parse(match.matchingReasonsJson) as string[];
      concerns = JSON.parse(match.concernsJson) as string[];
    } catch {
      /* ignore */
    }

    ranked.push({
      jobId: job.id,
      matchScore: match.matchScore,
      eligibility: match.eligibility,
      recommendation: match.recommendation,
      matchingReasons: reasons,
      concerns,
      postedAt: job.postedAt,
    });
  }

  ranked.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
    const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
    return tb - ta;
  });

  return ranked.slice(0, options.limit);
}

export function publishDailyJobList(limit: number): {
  published: number;
  jobIds: string[];
} {
  const ranked = rankJobsForPublish({ limit });
  const db = getDb();
  const now = nowIso();
  const jobIds: string[] = [];

  // Clear prior published-only markers for jobs not in new list? Keep simple: set published_at on selected
  for (const row of ranked) {
    db.update(jobs)
      .set({
        publishedAt: now,
        triageState:
          db.select().from(jobs).where(eq(jobs.id, row.jobId)).get()
            ?.triageState === "saved"
            ? "saved"
            : "published",
        updatedAt: now,
      })
      .where(eq(jobs.id, row.jobId))
      .run();
    jobIds.push(row.jobId);
  }

  return { published: jobIds.length, jobIds };
}

/** Helper used by pipeline when profile must exist. */
export function requireMatchingProfileJson(): {
  profileJson: string;
  version: number;
} {
  const approved = getApprovedProfile();
  if (!approved) {
    throw new Error("No approved structured profile for job matching");
  }
  return {
    profileJson: JSON.stringify(approved.profile),
    version: approved.version,
  };
}
