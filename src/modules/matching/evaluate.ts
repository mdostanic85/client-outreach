import { z } from "zod";
import { evaluationCacheVersion, opportunitySignal } from "./v2-signals";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, jobMatches, jobs } from "@/db/schema";
import type { SearchActivity } from "@/modules/search-experience/stages";
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
  MatchDimensionsSchema,
  finalizeMatchScore,
  mapMatchRecommendation,
  type JobMatchDimKey,
} from "@/modules/matching/score";
import { getJobMatchWeights } from "@/modules/matching/weights";
import { missingMandatoryLicences } from "@/modules/matching/requirements";
import {
  STRONG_MATCH_MIN,
  WORTH_A_LOOK_LIMIT,
  WORTH_A_LOOK_MIN,
} from "@/modules/matching/tiers";
import { currentUserId, owned } from "@/modules/auth/current-user";

export {
  STRONG_MATCH_MIN,
  WORTH_A_LOOK_LIMIT,
  WORTH_A_LOOK_MIN,
  matchTierForScore,
  type MatchTier,
} from "@/modules/matching/tiers";

export { profileForMatching } from "@/modules/profile/matching-sources";

function scoreActivity(title: string, company: string | null, location: string | null, score: number | null): SearchActivity {
  const rounded = score == null ? null : Math.round(score);
  return {
    kind: "score",
    label: title,
    meta: [company, location].filter(Boolean).join(" · ") || undefined,
    value: rounded == null ? "skipped" : String(rounded),
    tone:
      rounded == null ? "error"
      : rounded >= STRONG_MATCH_MIN ? "strong"
      : rounded >= WORTH_A_LOOK_MIN ? "worth"
      : "weak",
  };
}

async function companyName(companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  const row = (await getDb().select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  return row?.name ?? null;
}
export {
  RemoteFitSchema,
  type RemoteFit,
  type MatchHighlight,
} from "@/modules/matching/remote-fit";
export {
  JOB_MATCH_WEIGHTS,
  MatchDimensionsSchema,
  calculateMatchScore,
  finalizeMatchScore,
  mapMatchRecommendation,
  type MatchDimensions,
} from "@/modules/matching/score";

/** LLM output — dimensions required; model matchScore ignored if present. */
export const JobMatchLlmSchema = z.object({
  matchScore: z.number().min(0).max(100).optional(),
  dimensions: MatchDimensionsSchema,
  eligibility: z.enum(["eligible", "borderline", "ineligible"]),
  recommend: z.boolean().optional(),
  recommendation: z.enum(["apply", "consider", "skip"]).optional(),
  matchingReasons: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  missingRequirements: z.array(z.string()).default([]),
  /** Licences / certificates / permits the posting says are mandatory and the profile lacks. */
  mandatoryMissing: z.array(z.string()).default([]),
  mainRisk: z.string().optional(),
  remoteFit: RemoteFitSchema.optional(),
});

export const JobMatchResultSchema = JobMatchLlmSchema.extend({
  matchScore: z.number().min(0).max(100),
  recommend: z.boolean(),
  recommendation: z.enum(["apply", "consider", "skip"]),
  dimensions: MatchDimensionsSchema,
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

/**
 * A missing mandatory licence or certificate rules the posting out, however
 * good the rest looks. The model's list and our own licence check both count.
 */
export function applyHardRequirements(
  raw: z.infer<typeof JobMatchLlmSchema>,
  job: { title: string; description: string },
  licences: string[],
): z.infer<typeof JobMatchLlmSchema> {
  const missing = [
    ...new Set([
      ...raw.mandatoryMissing,
      ...missingMandatoryLicences({ ...job, licences }),
    ]),
  ];
  if (missing.length === 0) return raw;
  const requirements = raw.dimensions.requirements;
  return {
    ...raw,
    eligibility: "ineligible",
    mandatoryMissing: missing,
    mainRisk: raw.mainRisk ?? `Missing required: ${missing.join(", ")}`,
    concerns: [
      ...raw.concerns.filter((c) => !c.startsWith("Missing required:")),
      `Missing required: ${missing.join(", ")}`,
    ],
    dimensions: {
      ...raw.dimensions,
      requirements: {
        score: Math.min(requirements?.score ?? 0, 10),
        evidence: `Missing: ${missing.join(", ")}`.slice(0, 200),
      },
    },
  };
}

function normalizeMatchResult(
  raw: z.infer<typeof JobMatchLlmSchema>,
  jobContext: {
    remotePolicy: string | null;
    location: string | null;
    remoteRequired: boolean;
  },
  weights: Record<JobMatchDimKey, number>,
): JobMatchResult {
  let remoteFit = raw.remoteFit;
  if (!remoteFit) {
    remoteFit = deriveRemoteFit({
      remotePolicy: jobContext.remotePolicy,
      location: jobContext.location,
      concerns: raw.concerns,
      eligibility: raw.eligibility,
      remoteRequired: jobContext.remoteRequired,
    });
  }

  const { dimensions, matchScore } = finalizeMatchScore(
    raw.dimensions,
    {
      eligibility: raw.eligibility,
      remoteFit,
      remoteRequired: jobContext.remoteRequired,
    },
    weights,
  );

  const recommendation = mapMatchRecommendation({
    matchScore,
    eligibility: raw.eligibility,
    remoteFit,
    remoteRequired: jobContext.remoteRequired,
  });

  return {
    ...raw,
    dimensions,
    matchScore,
    recommendation,
    recommend: recommendation !== "skip",
    remoteFit,
  };
}

export type CandidateFeedback = {
  skipped: Array<{ title: string; reason: string | null }>;
  liked: string[];
};

/** Recent Save / Pass decisions, so new scores follow what the user actually picks. */
export async function loadCandidateFeedback(): Promise<CandidateFeedback> {
  const db = getDb();
  const [skipped, liked] = await Promise.all([
    db
      .select({ title: jobs.title, reason: jobs.rejectReason })
      .from(jobs)
      .where(and(await owned(jobs), eq(jobs.triageState, "rejected")))
      .orderBy(desc(jobs.updatedAt))
      .limit(15),
    db
      .select({ title: jobs.title })
      .from(jobs)
      .where(
        and(
          await owned(jobs),
          inArray(jobs.triageState, ["interested", "applied"]),
          isNotNull(jobs.title),
        ),
      )
      .orderBy(desc(jobs.updatedAt))
      .limit(10),
  ]);
  return { skipped, liked: liked.map((row) => row.title) };
}

async function evaluateOne(
  jobRow: typeof jobs.$inferSelect,
  profileJson: string,
  searchParams: JobSearchParams,
  weights: Record<JobMatchDimKey, number>,
  feedback: CandidateFeedback,
): Promise<{ result: JobMatchResult; model: string; costUsd: number }> {
  await assertPublicBudgetAllows("jobMatch");
  const system = loadPrompt("jobs/match-and-explain.md");
  const model = resolveModel("jobMatch");
  const profile = JSON.parse(profileJson) as { licenses?: unknown };
  const profileLicences = Array.isArray(profile.licenses)
    ? profile.licenses.filter((l): l is string => typeof l === "string")
    : [];
  const user = JSON.stringify(
    {
      profile,
      searchHints: searchParams,
      candidateFeedback: feedback,
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
    const parsed = normalizeMatchResult(
      applyHardRequirements(
        JobMatchLlmSchema.parse(parseJsonLoose(completion.text)),
        { title: jobRow.title, description: jobRow.description },
        profileLicences,
      ),
      {
        remotePolicy: jobRow.remotePolicy,
        location: jobRow.location,
        remoteRequired: searchParams.remoteRequired,
      },
      weights,
    );
    return {
      result: parsed,
      model,
      costUsd: completion.estimatedCost ?? 0,
    };
  };

  const isRateLimited = (err: unknown) =>
    err instanceof Error &&
    /Google LLM error 429|RESOURCE_EXHAUSTED/i.test(err.message);

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
  /** Stop scoring before this time so publish can still run. */
  deadline?: number;
}): Promise<{ evaluated: number; recommended: number; evaluatedJobIds: string[]; matchIds: Record<string, string> }> {
  const db = getDb();
  let evaluated = 0;
  let recommended = 0;
  const evaluatedJobIds: string[] = [];
  const matchIds: Record<string, string> = {};
  const matchingConfig = await getMatchingSourcesConfig();
  if (options.usePortfolioInMatching != null) {
    matchingConfig.portfolioProjects = options.usePortfolioInMatching;
  }
  const basePromptVersion = matchPromptVersion(matchingConfig);
  const weights = await getJobMatchWeights(options.searchParams.occupationFamily);
  const feedback = await loadCandidateFeedback();
  const total = options.jobIds.length;
  let done = 0;

  await options.onProgress?.(
    progressFor(
      "evaluate",
      evaluatePercent(0, Math.max(total, 1)),
      total > 0
        ? `Scoring ${total} roles against your profile…`
        : "Nothing new to score",
      { reviewed: 0, toScore: total, promising: 0 },
    ),
  );

  for (const jobId of options.jobIds) {
    if (options.deadline && Date.now() > options.deadline - 20_000) {
      await options.onProgress?.(
        progressFor(
          "evaluate",
          evaluatePercent(done, Math.max(total, 1)),
          `Scored ${done} of ${total} — publishing what's ready`,
          { reviewed: done, toScore: total, promising: recommended },
        ),
      );
      break;
    }
    const jobRow = (await db.select().from(jobs).where(and(await owned(jobs), eq(jobs.id, jobId))).limit(1))[0];
    if (!jobRow) {
      done++;
      continue;
    }

    const promptVersion = evaluationCacheVersion({
      promptVersion: basePromptVersion, model: resolveModel("jobMatch"),
      profileJson: options.profileJson, searchProfileVersion: options.searchProfileVersion,
      searchParams: options.searchParams, job: jobRow,
    });
    const existing = (await db
      .select()
      .from(jobMatches)
      .where(
        and(await owned(jobMatches),
          eq(jobMatches.jobId, jobId),
          eq(jobMatches.profileVersion, options.profileVersion),
          eq(jobMatches.promptVersion, promptVersion),
        ),
      ).limit(1))[0];
    if (existing) {
      matchIds[jobId] = existing.id;
      evaluated++;
      evaluatedJobIds.push(jobId);
      if (existing.recommend) recommended++;
      done++;
      await options.onProgress?.(
        progressFor(
          "evaluate",
          evaluatePercent(done, Math.max(total, 1)),
          `Already scored · ${jobRow.title}`,
          {
            reviewed: done,
            toScore: total,
            promising: recommended,
            regionOrCategory: undefined,
          },
          scoreActivity(jobRow.title, await companyName(jobRow.companyId), jobRow.location, existing.matchScore),
        ),
      );
      continue;
    }

    await options.onProgress?.(
      progressFor(
        "evaluate",
        evaluatePercent(done, Math.max(total, 1)),
        `Reading ${jobRow.title}${jobRow.location ? ` · ${jobRow.location}` : ""}`,
        {
          reviewed: done,
          toScore: total,
          promising: recommended,
          regionOrCategory: jobRow.location ?? undefined,
        },
      ),
    );

    try {
      const started = Date.now();
      const { result, model, costUsd } = await evaluateOne(
        jobRow,
        options.profileJson,
        options.searchParams,
        weights,
        feedback,
      );

      const matchId = newId("jmatch");
      await db.insert(jobMatches)
        .values({
      userId: await currentUserId(),
          id: matchId,
          jobId,
          profileVersion: options.profileVersion,
          searchProfileVersion: options.searchProfileVersion,
          matchScore: Math.round(result.matchScore),
          eligibility: result.eligibility,
          recommend: result.recommend ? 1 : 0,
          recommendation: result.recommendation ?? "skip",
          matchingReasonsJson: JSON.stringify(result.matchingReasons),
          concernsJson: JSON.stringify(result.concerns),
          scoreJson: JSON.stringify({ ...result, opportunity: opportunitySignal(jobRow) }),
          modelId: model,
          promptVersion,
          costUsd,
          createdAt: nowIso(),
        });

      matchIds[jobId] = matchId;
      evaluated++;
      evaluatedJobIds.push(jobId);
      if (result.recommend && result.eligibility !== "ineligible") recommended++;
      done++;
      await options.onProgress?.(
        progressFor(
          "evaluate",
          evaluatePercent(done, Math.max(total, 1)),
          `${jobRow.title} · score ${Math.round(result.matchScore)} · ${done}/${total}`,
          {
            reviewed: done,
            toScore: total,
            promising: recommended,
            regionOrCategory: jobRow.location ?? undefined,
          },
          scoreActivity(jobRow.title, await companyName(jobRow.companyId), jobRow.location, result.matchScore),
        ),
      );
      // Free-tier Gemini is about 15 requests a minute. Pace from the start of
      // the call, not an extra wait after it, or a full batch outlives the function.
      const wait = Math.max(0, 4_200 - (Date.now() - started));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    } catch (err) {
      done++;
      logger.warn({ err, jobId }, "job evaluate failed");
      await options.onProgress?.(
        progressFor(
          "evaluate",
          evaluatePercent(done, Math.max(total, 1)),
          `Skipped one role · ${done}/${total}`,
          { reviewed: done, toScore: total, promising: recommended },
          scoreActivity(jobRow.title, null, jobRow.location, null),
        ),
      );
    }
  }

  return { evaluated, recommended, evaluatedJobIds, matchIds };
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
  jobIds?: string[];
  matchIds?: Record<string, string>;
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
    .where(and(await owned(jobs), eq(jobs.status, "active"))))
    .filter(
      (j) =>
        j.triageState === "discovered" ||
        j.triageState === "published" ||
        j.triageState === "saved",
    );

  const ranked: RankedJob[] = [];
  for (const job of active) {
    if (options.jobIds && !options.jobIds.includes(job.id)) continue;
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
      .where(and(await owned(jobMatches), options.matchIds
        ? and(eq(jobMatches.jobId, job.id), eq(jobMatches.id, options.matchIds[job.id] ?? ""))
        : eq(jobMatches.jobId, job.id))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!match) continue;
    if (!match.recommend) continue;
    if (match.eligibility === "ineligible") continue;
    if (match.matchScore < minScore) continue;
    if (maxScoreExclusive != null && match.matchScore >= maxScoreExclusive) {
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
      await db.select().from(jobs).where(and(await owned(jobs), eq(jobs.id, row.jobId))).limit(1)
    )[0];
    await db
      .update(jobs)
      .set({
        publishedAt: now,
        triageState: existing?.triageState === "saved" ? "saved" : "published",
        updatedAt: now,
      })
      .where(and(await owned(jobs), eq(jobs.id, row.jobId)));
    jobIds.push(row.jobId);
  }

  return jobIds;
}

export async function publishDailyJobList(limit: number, jobIdsToPublish?: string[], matchIds?: Record<string, string>): Promise<{
  published: number;
  strong: number;
  worthALook: number;
  jobIds: string[];
}> {
  const strong = await rankJobsForPublish({
    jobIds: jobIdsToPublish,
    matchIds,
    minScore: STRONG_MATCH_MIN,
    limit,
  });
  const worthALook = await rankJobsForPublish({
    jobIds: jobIdsToPublish,
    matchIds,
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
