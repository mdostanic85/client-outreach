import { z } from "zod";
import type { StructuredProfile } from "./schemas";

/**
 * Matching preferences — affect score calculation only.
 * Never delete sources or professional knowledge.
 *
 * Pure helpers only — safe for Client Components.
 * DB accessors live in matching-sources.ts.
 */
export const MatchingSourcesConfigSchema = z.object({
  /** Portfolio case studies / project evidence in match prompts. */
  portfolioProjects: z.boolean().default(true),
  linkedin: z.boolean().default(true),
  cv: z.boolean().default(true),
  manual: z.boolean().default(true),
  github: z.boolean().default(true),
  /** Employment prefs, target roles, pay, locations from the profile. */
  jobPreferences: z.boolean().default(true),
  /** Future: likes/dislikes / triage signals. */
  activitySignals: z.boolean().default(true),
});

export type MatchingSourcesConfig = z.infer<typeof MatchingSourcesConfigSchema>;

export const DEFAULT_MATCHING_SOURCES: MatchingSourcesConfig = {
  portfolioProjects: true,
  linkedin: true,
  cv: true,
  manual: true,
  github: true,
  jobPreferences: true,
  activitySignals: true,
};

export function parseMatchingSourcesConfig(
  json: string | null | undefined,
  legacyUsePortfolio?: number | boolean | null,
): MatchingSourcesConfig {
  let parsed: Partial<MatchingSourcesConfig> = {};
  if (json && json.trim() && json !== "{}") {
    try {
      parsed = MatchingSourcesConfigSchema.partial().parse(JSON.parse(json));
    } catch {
      parsed = {};
    }
  }

  const portfolioProjects =
    parsed.portfolioProjects ??
    (legacyUsePortfolio === 0 || legacyUsePortfolio === false ? false : true);

  return MatchingSourcesConfigSchema.parse({
    ...DEFAULT_MATCHING_SOURCES,
    ...parsed,
    portfolioProjects,
  });
}

/**
 * Combine category toggles with per-source enabledForMatching flags.
 * A category stays on only if the toggle is on AND (no sources of that type
 * exist, or at least one source of that type is enabled for matching).
 */
export function resolveMatchingSourcesForScoring(
  config: MatchingSourcesConfig,
  sources: Array<{ type: string; enabledForMatching: number | boolean }>,
): MatchingSourcesConfig {
  const hasType = (type: string) => sources.some((s) => s.type === type);
  const typeEnabled = (type: string) =>
    sources.some(
      (s) =>
        s.type === type &&
        (s.enabledForMatching === 1 || s.enabledForMatching === true),
    );

  const gate = (enabled: boolean, type: string) =>
    enabled && (!hasType(type) || typeEnabled(type));

  return {
    ...config,
    portfolioProjects: gate(config.portfolioProjects, "portfolio_url"),
    linkedin: gate(config.linkedin, "linkedin_text"),
    cv: gate(config.cv, "cv"),
    manual: gate(config.manual, "manual"),
    github: gate(config.github, "github"),
  };
}

const PORTFOLIO_POINTER = /portfolio/i;
const LINKEDIN_POINTER = /linkedin/i;
const CV_POINTER = /\b(cv|resume)\b/i;
const GITHUB_POINTER = /github/i;
const MANUAL_POINTER = /manual|about you|notes/i;

export function isPortfolioProjectEvidence(project: {
  sourcePointers: string[];
  evidenceKind?: string | null;
}): boolean {
  if (project.evidenceKind === "portfolio_project") return true;
  if (project.evidenceKind === "general") return false;
  return project.sourcePointers.some((p) => PORTFOLIO_POINTER.test(p));
}

function projectMatchesDisabledSource(
  pointers: string[],
  config: MatchingSourcesConfig,
): boolean {
  if (!config.linkedin && pointers.some((p) => LINKEDIN_POINTER.test(p))) {
    return true;
  }
  if (!config.cv && pointers.some((p) => CV_POINTER.test(p))) {
    return true;
  }
  if (!config.github && pointers.some((p) => GITHUB_POINTER.test(p))) {
    return true;
  }
  if (!config.manual && pointers.some((p) => MANUAL_POINTER.test(p))) {
    return true;
  }
  return false;
}

/**
 * Build the profile payload used for job match scoring.
 * Strips match-disabled evidence only — never mutates stored profile JSON.
 */
export function profileForMatching(
  profile: StructuredProfile,
  config: MatchingSourcesConfig,
): StructuredProfile {
  const relevantProjects = profile.relevantProjects.filter((p) => {
    if (!config.portfolioProjects && isPortfolioProjectEvidence(p)) {
      return false;
    }
    if (projectMatchesDisabledSource(p.sourcePointers, config)) {
      return false;
    }
    return true;
  });

  const next: StructuredProfile = {
    ...profile,
    relevantProjects,
  };

  if (!config.jobPreferences) {
    next.preferredEmploymentTypes = [];
    next.preferredLocations = [];
    next.timeZones = [];
    next.targetRoles = [];
    next.rolesBelowLevel = [];
    next.rolesAboveLevel = [];
    next.compensation = undefined;
    next.salaryOrRateExpectations = undefined;
    next.availability = undefined;
  }

  return next;
}

export function matchingPromptSuffix(config: MatchingSourcesConfig): string {
  const off: string[] = [];
  if (!config.portfolioProjects) off.push("noportfolio");
  if (!config.linkedin) off.push("nolinkedin");
  if (!config.cv) off.push("nocv");
  if (!config.github) off.push("nogithub");
  if (!config.manual) off.push("nomanual");
  if (!config.jobPreferences) off.push("noprefs");
  return off.length ? `+${off.join("+")}` : "";
}

export const MATCHING_SOURCE_COPY: Record<
  keyof MatchingSourcesConfig,
  { label: string; helper: string }
> = {
  portfolioProjects: {
    label: "Use portfolio projects for job matching",
    helper:
      "Include skills, responsibilities, industries, and experience demonstrated in your portfolio projects when calculating job match scores. Turning this off will not delete your portfolio or professional profile.",
  },
  linkedin: {
    label: "Use LinkedIn information",
    helper:
      "Include work history, roles, skills, and education imported from LinkedIn. Does not delete LinkedIn data.",
  },
  cv: {
    label: "Use uploaded CV",
    helper:
      "Include facts extracted from your CV when scoring jobs. Does not delete the CV.",
  },
  manual: {
    label: "Use manually added information",
    helper:
      "Include notes and facts you entered yourself. Does not delete them.",
  },
  github: {
    label: "Use GitHub information",
    helper:
      "Include public repos and README evidence from GitHub. Does not delete the import.",
  },
  jobPreferences: {
    label: "Use job-search preferences",
    helper:
      "Include preferred roles, employment types, locations, and pay when scoring fits.",
  },
  activitySignals: {
    label: "Use previous likes and dislikes",
    helper:
      "Gently prefer patterns from jobs you marked Interested or rejected. Coming online as you triage more roles.",
  },
};
