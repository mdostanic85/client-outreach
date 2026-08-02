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
import {
  getMatchingSourcesConfig,
  matchingPromptSuffix,
  profileForMatching,
  resolveMatchingSourcesForScoring,
  type MatchingSourcesConfig,
} from "@/modules/profile/matching-sources";
import { getApprovedProfile } from "@/modules/profile/queries";
import type { JobSearchParams } from "@/modules/search-profile/schemas";
import {
  evaluatePercent,
  progressFor,
  type JobSearchProgressCallback,
} from "@/modules/jobs/progress";
import {
  RemoteFitSchema,
  deriveRemoteFit,
} from "@/modules/matching/remote-fit";
import {
  STRONG_MATCH_MIN,
  WORTH_A_LOOK_LIMIT,
  WORTH_A_LOOK_MIN,
} from "@/modules/matching/tiers";

export {
  STRONG_MATCH_MIN,
  WORTH_A_LOOK_LIMIT,
  WORTH_A_LOOK_MIN,
  matchTierForScore,
  type MatchTier,
} from "@/modules/matching/tiers";

export { profileForMatching } from "@/modules/profile/matching-sources";
export {
  RemoteFitSchema,
  type RemoteFit,
  type MatchHighlight,
} from "@/modules/matching/remote-fit";

export const JobMatchResultSchema = z.object({
  matchScore: z.number().min(0).max(100),
  eligibility: z.enum(["eligible", "borderline", "ineligible"]),
  recommend: z.boolean(),
  recommendation: z.enum(["apply", "consider", "skip"]).optional(),
  matchingReasons: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  missingRequirements: z.array(z.string()).default([]),
  mainRisk: z.string().optional(),
  remoteFit: RemoteFitSchema.optional(),
});

export type JobMatchResult = z.infer<typeof JobMatchResultSchema>;

function matchPromptVersion(config: MatchingSourcesConfig): string {
  const suffix = matchingPromptSuffix(config);
  return suffix
    ? `${JOB_MATCH_PROMPT_VERSION}${suffix}`
    : JOB_MATCH_PROMPT_VERSION;
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

function normalizeRecommendation(
  r: JobMatchResult,
  jobContext?: {
    remotePolicy: string | null;
    location: string | null;
    remoteRequired: boolean;
  },
): JobMatchResult {
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

  let remoteFit = r.remoteFit;
  if (!remoteFit && jobContext) {
    remoteFit = deriveRemoteFit({
      remotePolicy: jobContext.remotePolicy,
      location: jobContext.location,
      concerns: r.concerns,
      eligibility: r.eligibility,
      remoteRequired: jobContext.remoteRequired,
    });
  }

  return {
    ...r,
    recommendation,
    recommend: recommendation !== "skip",
    remoteFit,
  };
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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      {
        remotePolicy: jobRow.remotePolicy,
        location: jobRow.location,
        remoteRequired: searchParams.remoteRequired,
      },
    );
    return {
      result: parsed,
      model,
      costUsd: completion.estimatedCost ?? 0,
    };
  };

  const isRateLimited = (err: unknown) =>
    err instanceof Error && /Google LLM error 429|RESOURCE_EXHAUSTED/i.test(err.message);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await tryOnce();
    } catch (err) {
      lastErr = err;
      if (isRateLimited(err) && attempt < 3) {
        const waitMs = 18_000 + attempt * 5_000;
        logger.warn(
          { jobId: jobRow.id, attempt, waitMs },
          "job match rate-limited — waiting before retry",
        );
        await sleep(waitMs);
        continue;
      }
      if (attempt === 0) {
        logger.warn({ err, jobId: jobRow.id }, "job match parse failed — retry");
        continue;
      }
      break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function evaluateJobsBatch(options: {
  jobIds: string[];
  profileVersion: number;
  searchProfileVersion: number;
  searchParams: JobSearchParams;
  profileJson: string;
  /** Defaults from settings when omitted. */
  usePortfolioInMatching?: boolean;
  onProgress?: JobSearchProgressCallback;
}): Promise<{ evaluated: number; recommended: number }> {
  const db = getDb();
  let evaluated = 0;
  let recommended = 0;
  const matchingConfig = await getMatchingSourcesConfig();
  if (options.usePortfolioInMatching != null) {
    matchingConfig.portfolioProjects = options.usePortfolioInMatching;
  }
  const promptVersion = matchPromptVersion(matchingConfig);
  const total = options.jobIds.length;
  let done = 0;

  await options.onProgress?.(
    progressFor(
      "evaluate",
      evaluatePercent(0, Math.max(total, 1)),
      total > 0
        ? `Scoring ${total} roles against your profile…`
        : "Nothing new to score",
    ),
  );

  for (const jobId of options.jobIds) {
    const existing = (await db
      .select()
      .from(jobMatches)
      .where(
        and(
          eq(jobMatches.jobId, jobId),
          eq(jobMatches.profileVersion, options.profileVersion),
          eq(jobMatches.promptVersion, promptVersion),
        ),
      ).limit(1))[0];
    if (existing) {
      evaluated++;
      if (existing.recommend) recommended++;
      done++;
      await options.onProgress?.(
        progressFor(
          "evaluate",
          evaluatePercent(done, Math.max(total, 1)),
          `Cached score · ${done}/${total}`,
        ),
      );
      continue;
    }

    const jobRow = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
    if (!jobRow) {
      done++;
      continue;
    }

    await options.onProgress?.(
      progressFor(
        "evaluate",
        evaluatePercent(done, Math.max(total, 1)),
        `${jobRow.title}${jobRow.location ? ` · ${jobRow.location}` : ""}`,
      ),
    );

    try {
      const { result, model, costUsd } = await evaluateOne(
        jobRow,
        options.profileJson,
        options.searchParams,
      );

      await db.insert(jobMatches)
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
          promptVersion,
          costUsd,
          createdAt: nowIso(),
        });

      evaluated++;
      if (result.recommend && result.eligibility !== "ineligible") recommended++;
      done++;
      await options.onProgress?.(
        progressFor(
          "evaluate",
          evaluatePercent(done, Math.max(total, 1)),
          `${jobRow.title} · score ${Math.round(result.matchScore)} · ${done}/${total}`,
        ),
      );
      // Free-tier Gemini is ~15 RPM — pace new matches so a full batch survives.
      await new Promise((r) => setTimeout(r, 4_500));
    } catch (err) {
      done++;
      logger.warn({ err, jobId }, "job evaluate failed");
      await options.onProgress?.(
        progressFor(
          "evaluate",
          evaluatePercent(done, Math.max(total, 1)),
          `Skipped one role · ${done}/${total}`,
        ),
      );
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
 * Rank survivors for daily publish.
 * Strong band keeps a hard quality floor; worth-a-look is a separate secondary band.
 */
export async function rankJobsForPublish(options: {
  minScore?: number;
  maxScoreExclusive?: number;
  limit: number;
}): Promise<RankedJob[]> {
  const minScore = options.minScore ?? STRONG_MATCH_MIN;
  const maxScoreExclusive = options.maxScoreExclusive;
  const db = getDb();
  const active = (await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "active")))
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
    const match = (await db
      .select()
      .from(jobMatches)
      .where(eq(jobMatches.jobId, job.id)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!match) continue;
    if (!match.recommend) continue;
    if (match.eligibility === "ineligible") continue;
    if (match.matchScore < minScore) continue;
    if (
      maxScoreExclusive != null &&
      match.matchScore >= maxScoreExclusive
    ) {
      continue;
    }

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

async function markJobsPublished(ranked: RankedJob[]): Promise<string[]> {
  const db = getDb();
  const now = nowIso();
  const jobIds: string[] = [];

  for (const row of ranked) {
    const existing = (
      await db.select().from(jobs).where(eq(jobs.id, row.jobId)).limit(1)
    )[0];
    await db
      .update(jobs)
      .set({
        publishedAt: now,
        triageState:
          existing?.triageState === "saved" ? "saved" : "published",
        updatedAt: now,
      })
      .where(eq(jobs.id, row.jobId));
    jobIds.push(row.jobId);
  }

  return jobIds;
}

export async function publishDailyJobList(limit: number): Promise<{
  published: number;
  strong: number;
  worthALook: number;
  jobIds: string[];
}> {
  const strong = await rankJobsForPublish({
    minScore: STRONG_MATCH_MIN,
    limit,
  });
  const worthALook = await rankJobsForPublish({
    minScore: WORTH_A_LOOK_MIN,
    maxScoreExclusive: STRONG_MATCH_MIN,
    limit: WORTH_A_LOOK_LIMIT,
  });

  const strongIds = await markJobsPublished(strong);
  const worthIds = await markJobsPublished(worthALook);
  const jobIds = [...strongIds, ...worthIds];

  return {
    published: jobIds.length,
    strong: strongIds.length,
    worthALook: worthIds.length,
    jobIds,
  };
}

/** Helper used by pipeline when profile must exist. */
export async function requireMatchingProfileJson(): Promise<{
  profileJson: string;
  version: number;
  usePortfolioInMatching: boolean;
  matchingConfig: MatchingSourcesConfig;
}> {
  const approved = await getApprovedProfile();
  if (!approved) {
    throw new Error("No approved structured profile for job matching");
  }
  const matchingConfig = await resolveMatchingSourcesForScoring(
    await getMatchingSourcesConfig(),
  );
  return {
    profileJson: JSON.stringify(
      profileForMatching(approved.profile, matchingConfig),
    ),
    version: approved.version,
    usePortfolioInMatching: matchingConfig.portfolioProjects,
    matchingConfig,
  };
}
