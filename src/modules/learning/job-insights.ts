import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  jobSearchProfiles,
  learningProposals,
  learningReports,
  structuredProfiles,
} from "@/db/schema";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages } from "@/lib/ai/google";
import { resolveModel } from "@/lib/ai/routing";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import {
  JobSearchParamsSchema,
  type JobSearchParams,
} from "@/modules/search-profile/schemas";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";
import { assertJobGatesOrPreview } from "./job-gates";
import {
  buildGroundedInsights,
  computeStrategyCohort,
  listStrategyVersions,
  type StrategyCohort,
} from "./job-cohorts";
import { currentUserId, owned } from "@/modules/auth/current-user";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

async function nextSearchProfileVersion(): Promise<number> {
  const latest = (await getDb()
    .select({ version: jobSearchProfiles.version })
    .from(jobSearchProfiles)
    .where(await owned(jobSearchProfiles)).orderBy(desc(jobSearchProfiles.version)).limit(1))[0];
  return (latest?.version ?? 0) + 1;
}

function applyHeuristicDiff(
  params: JobSearchParams,
  cohort: StrategyCohort,
): { params: JobSearchParams; hypothesis: string[]; changes: string[] } {
  const next = JobSearchParamsSchema.parse(
    JSON.parse(JSON.stringify(params)),
  );
  const hypothesis: string[] = [];
  const changes: string[] = [];

  const hotTitles = cohort.segments.byTitle
    .filter((s) => s.interviewRate > 0 && s.applications >= 2)
    .slice(0, 3);
  for (const t of hotTitles) {
    if (!next.targetTitles.includes(t.label)) {
      next.targetTitles = [...next.targetTitles, t.label].slice(0, 8);
      changes.push(`Add title “${t.label}” (interview signal)`);
    }
  }

  const coldTitles = cohort.segments.byTitle.filter(
    (s) => s.applications >= 3 && s.interviews === 0 && s.responses === 0,
  );
  for (const t of coldTitles.slice(0, 3)) {
    if (
      next.targetTitles.some(
        (x) => x.toLowerCase() === t.label.toLowerCase(),
      )
    ) {
      next.targetTitles = next.targetTitles.filter(
        (x) => x.toLowerCase() !== t.label.toLowerCase(),
      );
      if (!next.excludedTitles.includes(t.label)) {
        next.excludedTitles = [...next.excludedTitles, t.label].slice(0, 20);
      }
      changes.push(`Remove cold title “${t.label}” (0 responses · n=${t.applications})`);
    }
  }

  const hotLoc = cohort.segments.byLocation.find(
    (s) => s.responseRate > 0 && s.applications >= 2,
  );
  if (hotLoc && !next.locations.some((l) => l.toLowerCase() === hotLoc.label.toLowerCase())) {
    next.locations = [...next.locations, hotLoc.label].slice(0, 8);
    changes.push(`Boost location “${hotLoc.label}”`);
  }

  if (cohort.interviewRate > 0) {
    hypothesis.push(
      `Prioritize segments with interview lift from Strategy v${cohort.strategyVersion} (${(cohort.interviewRate * 100).toFixed(0)}% interview rate).`,
    );
  }
  if (changes.length === 0) {
    hypothesis.push(
      "Insufficient segment contrast — keep matrix, tighten exclusions from reject reasons when available.",
    );
  }

  return {
    params: JobSearchParamsSchema.parse(next),
    hypothesis,
    changes,
  };
}

export async function generateWeeklyJobInsights(force = false) {
  await assertJobGatesOrPreview(force);
  const versions = await listStrategyVersions();
  const active = await getApprovedSearchProfile();
  const primary =
    versions.find((v) => v.strategyVersion === active?.version) ??
    versions[0] ??
    await computeStrategyCohort(active?.version ?? 1);

  const insights = buildGroundedInsights(primary);
  const previous = versions.find(
    (v) => v.strategyVersion === (active?.version ?? 0) - 1,
  );

  const deltaLines: string[] = [];
  if (previous && primary.confidence !== "low") {
    const interviewDelta = primary.interviewRate - previous.interviewRate;
    deltaLines.push(
      `Interview rate vs v${previous.strategyVersion}: ${interviewDelta >= 0 ? "+" : ""}${(interviewDelta * 100).toFixed(1)} pp`,
    );
    const responseDelta = primary.responseRate - previous.responseRate;
    deltaLines.push(
      `Response rate vs v${previous.strategyVersion}: ${responseDelta >= 0 ? "+" : ""}${(responseDelta * 100).toFixed(1)} pp`,
    );
  }

  const bodyMd = [
    `# Weekly job search review — Strategy v${primary.strategyVersion}`,
    "",
    `Confidence: **${primary.confidence}** · Applications: **${primary.applicationsN}** · Interviews: **${primary.interviewsN}** · Offers: **${primary.offersN}**`,
    "",
    "## Insights",
    ...insights.map((i) => `- ${i}`),
    "",
    ...(deltaLines.length
      ? ["## Vs previous strategy", ...deltaLines.map((d) => `- ${d}`), ""]
      : []),
    "## What this means",
    primary.confidence === "low"
      ? "Keep logging recruiter replies, interviews, and rejections. Insights stay honest until sample size clears the gate."
      : "Review the pending strategy proposal (if any) and accept only changes that match how you want to search next cycle.",
  ].join("\n");

  const id = newId("rep");
  await getDb()
    .insert(learningReports)
    .values({
      userId: await currentUserId(),
      id,
      kind: "job_weekly_insights",
      title: `Job search review · Strategy v${primary.strategyVersion}`,
      bodyMd,
      dataJson: JSON.stringify({
        strategyVersion: primary.strategyVersion,
        insights,
        kpis: {
          interviewRate: primary.interviewRate,
          responseRate: primary.responseRate,
          offerRate: primary.offerRate,
          applicationsN: primary.applicationsN,
          interviewsN: primary.interviewsN,
          offersN: primary.offersN,
          appsPerInterview: primary.appsPerInterview,
          confidence: primary.confidence,
        },
        vsPrevious: previous
          ? {
              version: previous.strategyVersion,
              interviewRate: previous.interviewRate,
              responseRate: previous.responseRate,
            }
          : null,
      }),
      model: null,
      createdAt: nowIso(),
    });

  logger.info({ id, version: primary.strategyVersion }, "weekly job insights saved");
  return { reportId: id, insights, cohort: primary };
}

const StrategyProposalLlmSchema = z.object({
  title: z.string(),
  summary: z.string(),
  hypothesis: z.string(),
  paramPatch: z
    .object({
      targetTitlesAdd: z.array(z.string()).optional(),
      targetTitlesRemove: z.array(z.string()).optional(),
      excludedTitlesAdd: z.array(z.string()).optional(),
      locationsAdd: z.array(z.string()).optional(),
      priorityIndustriesAdd: z.array(z.string()).optional(),
      avoidIndustriesAdd: z.array(z.string()).optional(),
      searchKeywordsAdd: z.array(z.string()).optional(),
      excludedKeywordsAdd: z.array(z.string()).optional(),
    })
    .optional(),
});

function mergeParamPatch(
  base: JobSearchParams,
  patch: z.infer<typeof StrategyProposalLlmSchema>["paramPatch"],
): JobSearchParams {
  const next = JobSearchParamsSchema.parse(JSON.parse(JSON.stringify(base)));
  if (!patch) return next;
  const addUnique = (arr: string[], extra: string[] = []) =>
    [...new Set([...arr, ...extra.map((s) => s.trim()).filter(Boolean)])];

  if (patch.targetTitlesAdd?.length) {
    next.targetTitles = addUnique(next.targetTitles, patch.targetTitlesAdd).slice(0, 8);
  }
  if (patch.targetTitlesRemove?.length) {
    const remove = new Set(patch.targetTitlesRemove.map((s) => s.toLowerCase()));
    next.targetTitles = next.targetTitles.filter(
      (t) => !remove.has(t.toLowerCase()),
    );
  }
  if (patch.excludedTitlesAdd?.length) {
    next.excludedTitles = addUnique(
      next.excludedTitles,
      patch.excludedTitlesAdd,
    ).slice(0, 24);
  }
  if (patch.locationsAdd?.length) {
    next.locations = addUnique(next.locations, patch.locationsAdd).slice(0, 8);
  }
  if (patch.priorityIndustriesAdd?.length) {
    next.priorityIndustries = addUnique(
      next.priorityIndustries,
      patch.priorityIndustriesAdd,
    ).slice(0, 12);
  }
  if (patch.avoidIndustriesAdd?.length) {
    next.avoidIndustries = addUnique(
      next.avoidIndustries,
      patch.avoidIndustriesAdd,
    ).slice(0, 12);
  }
  if (patch.searchKeywordsAdd?.length) {
    next.searchKeywords = addUnique(
      next.searchKeywords,
      patch.searchKeywordsAdd,
    ).slice(0, 16);
  }
  if (patch.excludedKeywordsAdd?.length) {
    next.excludedKeywords = addUnique(
      next.excludedKeywords,
      patch.excludedKeywordsAdd,
    ).slice(0, 24);
  }
  return JobSearchParamsSchema.parse(next);
}

export async function proposeSearchStrategyUpdate(force = false) {
  await assertJobGatesOrPreview(force);
  const db = getDb();
  const active = await getApprovedSearchProfile();
  if (!active) {
    throw new Error("Approve a search profile before proposing strategy updates");
  }

  const cohort = await computeStrategyCohort(active.version);
  const baseParams = JobSearchParamsSchema.parse(active.params);

  let title = `Search strategy v${active.version + 1} proposal`;
  let summary =
    "Deterministic proposal from outcome cohorts. Review the diff before approving.";
  let hypothesis = "";
  let nextParams = baseParams;
  let changes: string[] = [];
  let model: string | null = null;

  const heuristic = applyHeuristicDiff(baseParams, cohort);
  nextParams = heuristic.params;
  changes = heuristic.changes;
  hypothesis = heuristic.hypothesis.join(" ");

  try {
    model = resolveModel("jobWeeklyInsights");
    const system =
      "You propose job-search strategy updates from REAL cohort metrics only. " +
      "Return JSON {title, summary, hypothesis, paramPatch}. " +
      "Do not invent interview rates or companies. Prefer fewer changes. " +
      "Optimize interview/response rate, not application volume.";
    const user = JSON.stringify(
      {
        currentParams: baseParams,
        cohort: {
          strategyVersion: cohort.strategyVersion,
          applicationsN: cohort.applicationsN,
          interviewRate: cohort.interviewRate,
          responseRate: cohort.responseRate,
          confidence: cohort.confidence,
          segments: cohort.segments,
          insights: buildGroundedInsights(cohort),
        },
        heuristicChanges: changes,
      },
      null,
      2,
    );
    const completion = await anthropicProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "jobWeeklyInsights",
      temperature: 0.3,
    });
    const parsed = StrategyProposalLlmSchema.parse(
      parseJsonLoose(completion.text),
    );
    title = parsed.title;
    summary = parsed.summary;
    hypothesis = parsed.hypothesis;
    nextParams = mergeParamPatch(baseParams, parsed.paramPatch);
    if (parsed.paramPatch) {
      changes = [
        ...changes,
        ...Object.entries(parsed.paramPatch)
          .filter(([, v]) => Array.isArray(v) && v.length)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`),
      ];
    }
  } catch (err) {
    logger.warn({ err }, "LLM strategy proposal failed — using heuristic diff");
  }

  const approvedStructured = (await db
    .select()
    .from(structuredProfiles)
    .where(and(await owned(structuredProfiles), eq(structuredProfiles.status, "approved")))
    .orderBy(desc(structuredProfiles.version))
    .limit(1))[0];

  const draftId = newId("jsp");
  const version = await nextSearchProfileVersion();
  await db.insert(jobSearchProfiles)
    .values({
      userId: await currentUserId(),
      id: draftId,
      version,
      status: "draft",
      structuredProfileId: approvedStructured?.id ?? active.structuredProfileId,
      structuredProfileVersion:
        approvedStructured?.version ?? active.structuredProfileVersion,
      paramsJson: JSON.stringify(nextParams),
      rationaleJson: JSON.stringify([
        hypothesis,
        ...changes,
        ...buildGroundedInsights(cohort),
      ]),
      generationTrigger: "weekly_insight",
      parentVersion: active.version,
      hypothesisMd: hypothesis,
      modelId: model,
      promptVersion: "job-strategy-v1",
      costUsd: null,
      createdAt: nowIso(),
    });

  const proposalId = newId("prop");
  await db.insert(learningProposals)
    .values({
      userId: await currentUserId(),
      id: proposalId,
      kind: "search_strategy",
      title,
      summary,
      proposalJson: JSON.stringify({
        draftSearchProfileId: draftId,
        fromVersion: active.version,
        toVersion: version,
        hypothesis,
        changes,
        params: nextParams,
        cohortSnapshot: {
          applicationsN: cohort.applicationsN,
          interviewRate: cohort.interviewRate,
          responseRate: cohort.responseRate,
          confidence: cohort.confidence,
        },
      }),
      status: "pending",
      model,
      createdAt: nowIso(),
      decidedAt: null,
    });

  logger.info(
    { proposalId, draftId, from: active.version, to: version },
    "search strategy proposal created",
  );
  return { proposalId, draftId, version };
}
