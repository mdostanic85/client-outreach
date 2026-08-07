import { desc } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { jobMatches } from "@/db/schema";
import { parseMatchExtrasFromScoreJson } from "@/modules/matching/remote-fit";
import {
  resolveCompensation,
  type StructuredProfile,
} from "@/modules/profile/schemas";
import {
  getApprovedProfile,
  listProfileSources,
  type ProfileSourceRow,
} from "@/modules/profile/queries";

export type MarketFitFixTarget =
  | "sources"
  | "essentials"
  | "skills"
  | "preferences"
  | "evidence"
  | "advanced";

export type MarketFitFixType =
  | "approve_profile"
  | "update_source"
  | "add_skill"
  | "add_project_evidence"
  | "clarify_seniority"
  | "prefs_mismatch"
  | "add_leadership";

export type MarketFitAction = {
  id: string;
  label: string;
  detail: string;
  impact: "high" | "medium";
  done: boolean;
  fix: MarketFitFixTarget;
  fixType: MarketFitFixType;
};

export type MarketFitChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
};

export type MarketFitPillarId =
  | "sources"
  | "essentials"
  | "evidence"
  | "market";

export type MarketFitPillar = {
  id: MarketFitPillarId;
  label: string;
  impact: "high" | "medium";
  score: number;
  summary: string;
  description: string;
  checklist: MarketFitChecklistItem[];
  cta: { label: string; fix: MarketFitFixTarget };
};

export type MarketGap = {
  text: string;
  count: number;
  matchTotal: number;
  fixType: MarketFitFixType;
};

export type MarketFitLabel =
  | "Beginner"
  | "Building"
  | "Competitive"
  | "Strong";

export type MarketFitReport = {
  score: number;
  label: MarketFitLabel;
  summary: string;
  openHighImpactCount: number;
  pillars: MarketFitPillar[];
  actions: MarketFitAction[];
  marketGaps: MarketGap[];
  matchSampleSize: number;
};

export type MarketFitSourceInput = {
  type: string;
};

export type MatchGapInput = {
  concerns: string[];
  missingRequirements: string[];
};

const MARKET_MATCH_LIMIT = 40;

function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function projectsWithOutcomes(profile: StructuredProfile): number {
  return profile.relevantProjects.filter(
    (p) =>
      nonEmpty(p.title) &&
      (p.outcomes.some((o) => nonEmpty(o)) || nonEmpty(p.summary)),
  ).length;
}

function hasCompensation(profile: StructuredProfile): boolean {
  const c = resolveCompensation(profile);
  return c.min != null || c.max != null;
}

function hasPrefs(profile: StructuredProfile): boolean {
  return (
    profile.preferredEmploymentTypes.length > 0 &&
    (profile.preferredLocations.length > 0 || profile.timeZones.length > 0) &&
    hasCompensation(profile)
  );
}

function hasSeniorSignals(profile: StructuredProfile): boolean {
  return (
    nonEmpty(profile.leadershipExperience) ||
    profile.achievements.length > 0
  );
}

/** Normalize gap text for frequency aggregation. */
export function normalizeGapText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.…]+$/g, "")
    .slice(0, 160);
}

/**
 * Heuristic map from gap wording → actionable fix type.
 * Prefer evidence/skills over inventing claims.
 */
export function classifyGapFixType(text: string): MarketFitFixType {
  const t = text.toLowerCase();
  if (
    /\b(salary|compensat|rate|budget|timezone|time zone|location|remote|hybrid|onsite|on-site|relocat)\b/.test(
      t,
    )
  ) {
    return "prefs_mismatch";
  }
  if (
    /\b(senior|lead|staff|principal|leadership|manag|mentor|ic level|years?)\b/.test(
      t,
    )
  ) {
    return "clarify_seniority";
  }
  if (
    /\b(portfolio|case study|case-study|project|outcome|metric|impact|shipped|evidence)\b/.test(
      t,
    )
  ) {
    return "add_project_evidence";
  }
  if (
    /\b(linkedin|cv|resume|source|stale|outdated|missing profile)\b/.test(t)
  ) {
    return "update_source";
  }
  return "add_skill";
}

export function aggregateMarketGaps(
  matches: MatchGapInput[],
  topN = 5,
): MarketGap[] {
  if (matches.length === 0) return [];

  const counts = new Map<string, { text: string; count: number; fixType: MarketFitFixType }>();

  for (const match of matches) {
    const seenInMatch = new Set<string>();
    for (const raw of [...match.missingRequirements, ...match.concerns]) {
      const key = normalizeGapText(raw);
      if (!key || key.length < 4 || seenInMatch.has(key)) continue;
      seenInMatch.add(key);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          text: raw.trim().replace(/\s+/g, " "),
          count: 1,
          fixType: classifyGapFixType(raw),
        });
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, topN)
    .map((g) => ({
      text: g.text,
      count: g.count,
      matchTotal: matches.length,
      fixType: g.fixType,
    }));
}

function scoreFromChecks(checks: MarketFitChecklistItem[]): number {
  if (checks.length === 0) return 100;
  const done = checks.filter((c) => c.done).length;
  return Math.round((done / checks.length) * 100);
}

function labelFromScore(score: number): MarketFitLabel {
  if (score >= 85) return "Strong";
  if (score >= 65) return "Competitive";
  if (score >= 40) return "Building";
  return "Beginner";
}

function summaryFor(
  label: MarketFitLabel,
  openHigh: number,
  topGap: MarketGap | undefined,
  evidenceDone: boolean,
): string {
  if (label === "Strong" && openHigh === 0) {
    return "Strong market fit — keep sources fresh and re-approve after big wins.";
  }
  if (!evidenceDone) {
    return "Solid start — portfolio outcomes and case-study evidence are the biggest unlock for senior roles.";
  }
  if (topGap) {
    return `Building toward competitive fit — recurring gap vs roles: “${topGap.text}” (${topGap.count}/${topGap.matchTotal} matches).`;
  }
  if (openHigh > 0) {
    return `Solid foundation — ${openHigh} high-impact fix${openHigh === 1 ? "" : "es"} left before you’re competitive for more companies.`;
  }
  return "Keep tightening evidence and prefs so matching stays honest and sharp.";
}

function fixTargetForGap(fixType: MarketFitFixType): MarketFitFixTarget {
  switch (fixType) {
    case "prefs_mismatch":
      return "preferences";
    case "clarify_seniority":
    case "add_leadership":
      return "essentials";
    case "add_project_evidence":
      return "evidence";
    case "update_source":
    case "approve_profile":
      return "sources";
    case "add_skill":
    default:
      return "skills";
  }
}

function ctaForFix(fix: MarketFitFixTarget): { label: string; fix: MarketFitFixTarget } {
  switch (fix) {
    case "sources":
      return { label: "Review sources", fix: "sources" };
    case "essentials":
      return { label: "Go to Essentials", fix: "essentials" };
    case "skills":
      return { label: "Go to Skills", fix: "skills" };
    case "preferences":
      return { label: "Go to Job prefs", fix: "preferences" };
    case "evidence":
      return { label: "Add project outcomes", fix: "evidence" };
    case "advanced":
      return { label: "Go to More", fix: "advanced" };
  }
}

export function computeMarketFit(input: {
  profile: StructuredProfile | null;
  approved: boolean;
  sources: MarketFitSourceInput[];
  matches?: MatchGapInput[];
}): MarketFitReport {
  const profile = input.profile;
  const sources = input.sources;
  const matches = input.matches ?? [];

  const hasCvOrLinkedIn = sources.some(
    (s) => s.type === "cv" || s.type === "linkedin_text",
  );
  const hasPortfolio = sources.some((s) => s.type === "portfolio_url");
  const sourceTypes = new Set(sources.map((s) => s.type));

  const sourcesChecklist: MarketFitChecklistItem[] = [
    {
      id: "approved",
      label: "Approved profile for matching",
      done: input.approved && profile != null,
      detail: input.approved
        ? "Matching uses this version."
        : "Approve a draft so jobs can score against you.",
    },
    {
      id: "cv_or_linkedin",
      label: "CV or LinkedIn source",
      done: hasCvOrLinkedIn,
      detail: "At least one career narrative source.",
    },
    {
      id: "portfolio",
      label: "Portfolio URL",
      done: hasPortfolio,
      detail: "Case-study evidence for senior design roles.",
    },
    {
      id: "source_breadth",
      label: "Multiple source types",
      done: sourceTypes.size >= 2,
      detail: `${sourceTypes.size} source type${sourceTypes.size === 1 ? "" : "s"} ingested.`,
    },
  ];

  const essentialsChecklist: MarketFitChecklistItem[] = [
    {
      id: "role",
      label: "Current role",
      done: nonEmpty(profile?.currentRole),
    },
    {
      id: "seniority",
      label: "Seniority",
      done: nonEmpty(profile?.seniority),
    },
    {
      id: "years",
      label: "Years of experience",
      done: profile?.yearsExperience != null,
    },
    {
      id: "target_roles",
      label: "Target roles",
      done: (profile?.targetRoles.length ?? 0) > 0,
    },
    {
      id: "skills",
      label: "Strongest skills (5+)",
      done: (profile?.strongestSkills.length ?? 0) >= 5,
      detail: `${profile?.strongestSkills.length ?? 0} listed`,
    },
    {
      id: "tools",
      label: "Design tools (3+)",
      done: (profile?.designTools.length ?? 0) >= 3,
      detail: `${profile?.designTools.length ?? 0} listed`,
    },
    {
      id: "differentiators",
      label: "Strengths & differentiators (2+)",
      done: (profile?.strengthsAndDifferentiators.length ?? 0) >= 2,
    },
    {
      id: "senior_signals",
      label: "Leadership or achievements",
      done: profile ? hasSeniorSignals(profile) : false,
    },
    {
      id: "prefs",
      label: "Job prefs (pay, type, location/TZ)",
      done: profile ? hasPrefs(profile) : false,
    },
  ];

  const evidenceCount = profile ? projectsWithOutcomes(profile) : 0;
  const evidenceChecklist: MarketFitChecklistItem[] = [
    {
      id: "projects_2",
      label: "At least 2 projects with outcomes",
      done: evidenceCount >= 2,
      detail: `${evidenceCount} project${evidenceCount === 1 ? "" : "s"} with summary or outcomes`,
    },
    {
      id: "projects_outcomes_rich",
      label: "Outcomes on 2+ projects (not summary-only)",
      done:
        (profile?.relevantProjects.filter((p) =>
          p.outcomes.some((o) => nonEmpty(o)),
        ).length ?? 0) >= 2,
    },
    {
      id: "industries",
      label: "Industries or product types",
      done:
        (profile?.industries.length ?? 0) > 0 ||
        (profile?.productTypes.length ?? 0) > 0,
    },
  ];

  const marketGaps = aggregateMarketGaps(matches);
  const marketChecklist: MarketFitChecklistItem[] =
    matches.length === 0
      ? [
          {
            id: "no_matches",
            label: "Score some jobs to surface market gaps",
            done: false,
            detail: "Market demand unlocks after matching runs.",
          },
        ]
      : marketGaps.map((g) => ({
          id: `gap:${normalizeGapText(g.text)}`,
          label: g.text,
          done: false,
          detail: `Appears in ${g.count}/${g.matchTotal} matches`,
        }));

  // Recurring gaps are never "done" via profile alone — closing them is user work.
  // Pillar score: if no matches, treat as N/A (100 for weighting skip); if matches,
  // score inversely by how many top gaps dominate (fewer unique high-frequency gaps = better).
  let marketScore: number;
  if (matches.length === 0) {
    marketScore = 100;
  } else if (marketGaps.length === 0) {
    marketScore = 100;
  } else {
    const weightedPressure = marketGaps.reduce(
      (sum, g) => sum + g.count / g.matchTotal,
      0,
    );
    // 0 pressure → 100; ~2.5+ cumulative frequency → ~0
    marketScore = Math.max(
      0,
      Math.min(100, Math.round(100 - (weightedPressure / 2.5) * 100)),
    );
  }

  const sourcesScore = scoreFromChecks(sourcesChecklist);
  const essentialsScore = scoreFromChecks(essentialsChecklist);
  const evidenceScore = scoreFromChecks(evidenceChecklist);
  const completenessScore = Math.round(
    (sourcesScore + essentialsScore) / 2,
  );

  const hasMarketSignal = matches.length > 0;
  let score: number;
  if (hasMarketSignal) {
    score = Math.round(
      completenessScore * 0.5 + evidenceScore * 0.25 + marketScore * 0.25,
    );
  } else {
    score = Math.round(completenessScore * (2 / 3) + evidenceScore * (1 / 3));
  }

  const label = labelFromScore(score);

  const pillars: MarketFitPillar[] = [
    {
      id: "sources",
      label: "Sources & approval",
      impact: "high",
      score: sourcesScore,
      summary:
        sourcesScore >= 100
          ? "Ready"
          : `${sourcesChecklist.filter((c) => !c.done).length} to fix`,
      description:
        "Ingest CV/LinkedIn/portfolio and approve the version used for matching. Stale or thin sources weaken every job score.",
      checklist: sourcesChecklist,
      cta: ctaForFix(
        !input.approved ? "sources" : !hasPortfolio ? "sources" : "sources",
      ),
    },
    {
      id: "essentials",
      label: "Essentials & positioning",
      impact: "high",
      score: essentialsScore,
      summary:
        essentialsScore >= 100
          ? "Complete"
          : `${essentialsChecklist.filter((c) => !c.done).length} open`,
      description:
        "Role, seniority, skills, differentiators, and prefs so companies see a clear senior product designer fit.",
      checklist: essentialsChecklist,
      cta: ctaForFix(
        !nonEmpty(profile?.currentRole) || !nonEmpty(profile?.seniority)
          ? "essentials"
          : (profile?.strongestSkills.length ?? 0) < 5
            ? "skills"
            : !profile || !hasPrefs(profile)
              ? "preferences"
              : "essentials",
      ),
    },
    {
      id: "evidence",
      label: "Evidence",
      impact: "high",
      score: evidenceScore,
      summary:
        evidenceScore >= 100
          ? "Strong"
          : `${evidenceCount}/2 projects`,
      description:
        "Senior roles expect case studies with measurable outcomes — not titles alone.",
      checklist: evidenceChecklist,
      cta: ctaForFix("evidence"),
    },
  ];

  if (hasMarketSignal) {
    pillars.push({
      id: "market",
      label: "Market demand gaps",
      impact: "high",
      score: marketScore,
      summary:
        marketGaps.length === 0
          ? "Clear"
          : `${marketGaps.length} recurring`,
      description:
        "Themes that keep showing up across scored jobs. Close them with real skills or project evidence — do not invent claims.",
      checklist: marketChecklist,
      cta: ctaForFix(
        marketGaps[0] ? fixTargetForGap(marketGaps[0].fixType) : "skills",
      ),
    });
  }

  const actions: MarketFitAction[] = [];

  for (const item of sourcesChecklist) {
    if (item.done) continue;
    actions.push({
      id: `sources:${item.id}`,
      label: item.label,
      detail: item.detail ?? "",
      impact: "high",
      done: false,
      fix: "sources",
      fixType:
        item.id === "approved" ? "approve_profile" : "update_source",
    });
  }

  for (const item of essentialsChecklist) {
    if (item.done) continue;
    let fix: MarketFitFixTarget = "essentials";
    let fixType: MarketFitFixType = "clarify_seniority";
    if (item.id === "skills" || item.id === "tools") {
      fix = "skills";
      fixType = "add_skill";
    } else if (item.id === "prefs") {
      fix = "preferences";
      fixType = "prefs_mismatch";
    } else if (item.id === "senior_signals") {
      fix = "essentials";
      fixType = "add_leadership";
    } else if (item.id === "differentiators") {
      fix = "skills";
      fixType = "add_skill";
    }
    actions.push({
      id: `essentials:${item.id}`,
      label: item.label,
      detail: item.detail ?? "",
      impact:
        item.id === "role" ||
        item.id === "seniority" ||
        item.id === "target_roles" ||
        item.id === "skills"
          ? "high"
          : "medium",
      done: false,
      fix,
      fixType,
    });
  }

  for (const item of evidenceChecklist) {
    if (item.done) continue;
    actions.push({
      id: `evidence:${item.id}`,
      label: item.label,
      detail: item.detail ?? "",
      impact: "high",
      done: false,
      fix: item.id === "industries" ? "skills" : "evidence",
      fixType: "add_project_evidence",
    });
  }

  for (const gap of marketGaps.slice(0, 3)) {
    actions.push({
      id: `market:${normalizeGapText(gap.text)}`,
      label: gap.text,
      detail: `Appears in ${gap.count}/${gap.matchTotal} matches`,
      impact: gap.count / gap.matchTotal >= 0.25 ? "high" : "medium",
      done: false,
      fix: fixTargetForGap(gap.fixType),
      fixType: gap.fixType,
    });
  }

  const openHighImpactCount = actions.filter(
    (a) => a.impact === "high" && !a.done,
  ).length;

  return {
    score,
    label,
    summary: summaryFor(
      label,
      openHighImpactCount,
      marketGaps[0],
      evidenceChecklist[0]?.done ?? false,
    ),
    openHighImpactCount,
    pillars,
    actions,
    marketGaps,
    matchSampleSize: matches.length,
  };
}

export async function loadRecentMatchGaps(
  limit = MARKET_MATCH_LIMIT,
): Promise<MatchGapInput[]> {
  const rows = await getDb()
    .select({
      concernsJson: jobMatches.concernsJson,
      scoreJson: jobMatches.scoreJson,
    })
    .from(jobMatches)
    .orderBy(desc(jobMatches.createdAt))
    .limit(limit);

  return rows.map((row) => {
    let concerns: string[] = [];
    try {
      concerns = JSON.parse(row.concernsJson || "[]") as string[];
      if (!Array.isArray(concerns)) concerns = [];
    } catch {
      concerns = [];
    }
    const extras = parseMatchExtrasFromScoreJson(row.scoreJson);
    return {
      concerns: concerns.filter(
        (c): c is string => typeof c === "string" && c.trim().length > 0,
      ),
      missingRequirements: extras.missingRequirements,
    };
  });
}

export const getMarketFitReport = cache(async (): Promise<MarketFitReport> => {
  const [approved, sources, matches] = await Promise.all([
    getApprovedProfile(),
    listProfileSources(),
    loadRecentMatchGaps(),
  ]);

  return computeMarketFit({
    profile: approved?.profile ?? null,
    approved: approved != null,
    sources: sources.map((s: ProfileSourceRow) => ({ type: s.type })),
    matches,
  });
});

/** Short TTL so nav badges don't rebuild the full report on every click. */
const OPEN_COUNT_TTL_MS = 30_000;
let openCountCache: { at: number; count: number } | null = null;

/** Count open high-impact actions for sidebar badge. */
export async function getMarketFitOpenCount(): Promise<number> {
  const now = Date.now();
  if (openCountCache && now - openCountCache.at < OPEN_COUNT_TTL_MS) {
    return openCountCache.count;
  }
  const report = await getMarketFitReport();
  openCountCache = { at: now, count: report.openHighImpactCount };
  return report.openHighImpactCount;
}

/** Call after profile/source edits so the badge can refresh immediately. */
export function invalidateMarketFitOpenCount() {
  openCountCache = null;
}
