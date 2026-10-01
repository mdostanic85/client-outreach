import { z } from "zod";
import { getOccupation } from "@/modules/occupations/catalog";
import {
  FAMILY_PROFILES,
  OccupationFamilySchema,
  type OccupationFamily,
} from "@/modules/occupations/families";
import {
  COMPENSATION_CURRENCIES,
  formatCompensation,
  type StructuredProfile,
} from "@/modules/profile/schemas";
import { occupationSearchTerms } from "@/modules/occupations/search";
import { softenInferredFilters } from "@/modules/search-profile/widen";
import {
  withMarketDefaults,
  type JobSearchParams,
} from "@/modules/search-profile/schemas";

/** Legacy single choice; new answers use `engagement`. */
export const WORK_TYPES = ["full_time", "contract", "both"] as const;
export const ENGAGEMENTS = [
  "full_time",
  "part_time",
  "shift",
  "seasonal",
  "freelance",
  "internship",
] as const;
export const EXPERIENCE = ["none", "under2", "2to5", "5plus", "leads"] as const;
export const LEVELS = ["junior", "mid", "senior", "lead", "head"] as const;
export const WORK_MODES = ["remote", "hybrid", "onsite", "any"] as const;
export const AVAILABILITY = ["now", "soon", "exploring"] as const;
export const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
export const PRIORITIES = [
  "pay",
  "flexibility",
  "product",
  "team",
  "growth",
  "mission",
  "balance",
  "stability",
  "close_to_home",
  "fixed_schedule",
] as const;

export const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead",
  head: "Head / Director",
};

export const EXPERIENCE_LABELS: Record<(typeof EXPERIENCE)[number], string> = {
  none: "No experience yet",
  under2: "Under 2 years",
  "2to5": "2–5 years",
  "5plus": "5+ years",
  leads: "Leads a team",
};

export const ENGAGEMENT_LABELS: Record<(typeof ENGAGEMENTS)[number], string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  shift: "Shift work",
  seasonal: "Seasonal",
  freelance: "Freelance",
  internship: "Internship",
};

export const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
  pay: "Compensation",
  flexibility: "Flexible hours",
  product: "Great product",
  team: "Strong team",
  growth: "Room to grow",
  mission: "Meaningful mission",
  balance: "Work-life balance",
  stability: "Stable company",
  close_to_home: "Close to home",
  fixed_schedule: "Predictable schedule",
};

const AVAILABILITY_LABELS: Record<(typeof AVAILABILITY)[number], string> = {
  now: "Available now",
  soon: "Available in 1–2 months",
  exploring: "Open to the right role",
};

export const SurveySchema = z.object({
  /** Legacy (before `engagement`). */
  workType: z.enum(WORK_TYPES).optional(),
  role: z.string().trim().max(80).optional(),
  /** Catalog id when the role is one we know. */
  occupationId: z.string().max(60).nullable().optional(),
  occupationFamily: OccupationFamilySchema.optional(),
  /** Other names for the role (catalog or model), used to widen search. */
  occupationSynonyms: z.array(z.string().trim().min(1).max(80)).max(16).optional(),
  experience: z.enum(EXPERIENCE).optional(),
  level: z.enum(LEVELS).optional(),
  engagement: z.array(z.enum(ENGAGEMENTS)).max(ENGAGEMENTS.length).optional(),
  workMode: z.enum(WORK_MODES).optional(),
  locations: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
  /** Null = anywhere in the country / doesn't matter. */
  commuteKm: z.number().int().positive().max(1000).nullable().optional(),
  pay: z
    .object({
      mode: z.enum(["salary", "monthly", "hourly"]),
      currency: z.enum(COMPENSATION_CURRENCIES),
      min: z.number().positive().max(10_000_000),
    })
    .nullable()
    .optional(),
  availability: z.enum(AVAILABILITY).optional(),
  // Family questions — only the relevant ones are asked.
  /** Driving licence categories and ADR, e.g. ["C", "CE", "ADR"]. */
  licenses: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  tachographCard: z.boolean().optional(),
  internationalRoutes: z.boolean().optional(),
  /** Holds the professional licence the job requires (nursing, teaching…). */
  professionalLicense: z.boolean().optional(),
  shifts: z.boolean().optional(),
  nights: z.boolean().optional(),
  weekends: z.boolean().optional(),
  sanitaryBook: z.boolean().optional(),
  ownTools: z.boolean().optional(),
  certifications: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  stack: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  /** Set once the family screen was answered (even if every answer was "no"). */
  detailsDone: z.boolean().optional(),
  languages: z
    .array(
      z.object({
        language: z.string().trim().min(1).max(40),
        level: z.enum(LANGUAGE_LEVELS),
      }),
    )
    .max(8)
    .optional(),
  priorities: z.array(z.enum(PRIORITIES)).max(3).optional(),
  websiteUrl: z.string().trim().max(300).optional(),
});

export type SurveyAnswers = z.infer<typeof SurveySchema>;

export type SurveyStep =
  | "intro"
  | "role"
  | "family"
  | "experience"
  | "level"
  | "engagement"
  | "workMode"
  | "location"
  | "pay"
  | "availability"
  | "details"
  | "languages"
  | "priorities";

/** Question screens for this person, in order. Depends on the family. */
export function surveySteps(survey: SurveyAnswers): SurveyStep[] {
  const family = survey.occupationFamily ? FAMILY_PROFILES[survey.occupationFamily] : null;
  return [
    "intro",
    "role",
    // Only when we couldn't place the role ourselves.
    ...(survey.role && !survey.occupationFamily ? (["family"] as const) : []),
    "experience",
    ...(family?.usesLevels ? (["level"] as const) : []),
    "engagement",
    "workMode",
    "location",
    "pay",
    "availability",
    "details",
    "languages",
    "priorities",
  ];
}

function answered(survey: SurveyAnswers, step: SurveyStep): boolean {
  switch (step) {
    case "intro":
      return Object.keys(survey).length > 0;
    case "role":
      return Boolean(survey.role);
    case "family":
      return Boolean(survey.occupationFamily);
    case "experience":
      return Boolean(survey.experience);
    case "level":
      return Boolean(survey.level);
    case "engagement":
      return Boolean(survey.engagement?.length || survey.workType);
    case "workMode":
      return Boolean(survey.workMode);
    case "location":
      return survey.locations !== undefined;
    case "pay":
      return survey.pay !== undefined;
    case "availability":
      return Boolean(survey.availability);
    case "details":
      return Boolean(survey.detailsDone);
    case "languages":
      return survey.languages !== undefined;
    case "priorities":
      return survey.priorities !== undefined;
  }
}

/** Where a returning user picks up: first unanswered question, or the next stage. */
export function firstOpenQuestion(survey: SurveyAnswers): SurveyStep | null {
  return surveySteps(survey).find((step) => !answered(survey, step)) ?? null;
}

/** Remote is only offered where it's a realistic option. */
export function remoteOffered(family: OccupationFamily | undefined): boolean {
  return family ? FAMILY_PROFILES[family].remoteCommon : true;
}

function unique(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const v = value?.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

function employmentTypes(survey: SurveyAnswers): string[] {
  if (survey.engagement?.length) {
    return survey.engagement.map((e) => ENGAGEMENT_LABELS[e]);
  }
  if (survey.workType === "full_time") return ["Full-time"];
  if (survey.workType === "contract") return ["Contract", "Freelance"];
  return ["Full-time", "Contract"];
}

function hasEngagementAnswer(survey: SurveyAnswers): boolean {
  return Boolean(survey.engagement?.length || survey.workType);
}

function locationList(survey: SurveyAnswers): string[] {
  const picked = survey.locations ?? [];
  if (survey.workMode === "remote") return unique(["Remote", ...picked]);
  return picked.length ? picked : ["Serbia"];
}

const LANGUAGE_LEVEL_LABELS: Record<(typeof LANGUAGE_LEVELS)[number], string> = {
  basic: "basic",
  conversational: "conversational",
  fluent: "fluent",
  native: "native",
};

function languageLines(survey: SurveyAnswers): string[] {
  return (survey.languages ?? []).map(
    (l) => `${l.language} (${LANGUAGE_LEVEL_LABELS[l.level]})`,
  );
}

/** Replace a stated language with the survey's level, keep the others. */
function mergeLanguages(existing: string[], fromSurvey: string[]): string[] {
  const name = (line: string) => line.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
  const surveyed = new Set(fromSurvey.map(name));
  return [...fromSurvey, ...existing.filter((line) => !surveyed.has(name(line)))];
}

function certificationList(survey: SurveyAnswers): string[] {
  return unique([
    ...(survey.certifications ?? []),
    survey.sanitaryBook ? "Sanitary booklet" : null,
    survey.tachographCard ? "Digital tachograph card" : null,
  ]);
}

/** What the user told us wins over what the model read from the CV. */
export function applySurveyToProfile(
  profile: StructuredProfile,
  survey: SurveyAnswers,
): StructuredProfile {
  const next: StructuredProfile = { ...profile };
  if (survey.role) next.targetRoles = unique([survey.role, ...profile.targetRoles]);
  if (survey.occupationFamily) next.occupationFamily = survey.occupationFamily;
  if (survey.occupationId) next.occupationId = survey.occupationId;
  // Only a real level goes into `seniority` — it prefixes the role and CV
  // headline, and "5+ years Truck Driver" reads wrong. Years come from the CV.
  if (survey.level) next.seniority = LEVEL_LABELS[survey.level];
  if (hasEngagementAnswer(survey)) next.preferredEmploymentTypes = employmentTypes(survey);
  if (survey.workMode || survey.locations?.length) {
    next.preferredLocations = locationList(survey);
  }
  if (survey.commuteKm !== undefined) next.commuteRadiusKm = survey.commuteKm;
  if (survey.pay) {
    next.compensation = {
      mode: survey.pay.mode,
      currency: survey.pay.currency,
      min: survey.pay.min,
      max: null,
    };
  }
  if (survey.availability) next.availability = AVAILABILITY_LABELS[survey.availability];
  if (survey.licenses?.length) next.licenses = unique([...survey.licenses, ...profile.licenses]);
  if (survey.professionalLicense) {
    next.licenses = unique([...next.licenses, "Professional licence"]);
  }
  const certs = certificationList(survey);
  if (certs.length) next.certifications = unique([...profile.certifications, ...certs]);
  if (survey.stack?.length) next.tools = unique([...survey.stack, ...profile.tools]);
  if (survey.shifts !== undefined || survey.nights !== undefined || survey.weekends !== undefined) {
    next.schedule = {
      ...profile.schedule,
      ...(survey.shifts !== undefined ? { shifts: survey.shifts } : {}),
      ...(survey.nights !== undefined ? { nights: survey.nights } : {}),
      ...(survey.weekends !== undefined ? { weekends: survey.weekends } : {}),
    };
  }
  if (survey.internationalRoutes !== undefined) next.willingToTravel = survey.internationalRoutes;
  if (survey.languages?.length) {
    next.languages = mergeLanguages(profile.languages, languageLines(survey));
  }
  if (survey.priorities?.length) {
    const labels = survey.priorities.map((p) => PRIORITY_LABELS[p]).join(", ");
    next.workingStyle = unique([profile.workingStyle, `Priorities: ${labels}`]).join(" · ");
  }
  return next;
}

/**
 * The remote filter the person chose in the survey, or null when they didn't
 * say. Only this answer may make search remote-only.
 */
export function remoteChoice(
  survey: SurveyAnswers,
): Pick<JobSearchParams, "remoteRequired" | "remotePolicy"> | null {
  if (!survey.workMode) return null;
  const remote = survey.workMode === "remote" && remoteOffered(survey.occupationFamily);
  return {
    remoteRequired: remote,
    remotePolicy: remote
      ? "remote_ok_required"
      : survey.workMode === "hybrid"
        ? "remote_preferred"
        : "any",
  };
}

/**
 * Remote-only follows the survey. Without an answer, a remote requirement
 * that came from a CV or website header stays a preference instead.
 */
export function applyRemoteChoice(params: JobSearchParams, survey: SurveyAnswers): JobSearchParams {
  const choice = remoteChoice(survey);
  return choice ? { ...params, ...choice } : softenInferredFilters(params, { remoteOnly: undefined });
}

export function applySurveyToSearchParams(
  params: JobSearchParams,
  survey: SurveyAnswers,
): JobSearchParams {
  const next: JobSearchParams = { ...params };
  if (survey.role) next.targetTitles = unique([survey.role, ...params.targetTitles]).slice(0, 5);
  if (survey.level) next.seniority = [LEVEL_LABELS[survey.level]];
  if (hasEngagementAnswer(survey)) next.employmentTypes = employmentTypes(survey);
  const remote = remoteChoice(survey);
  if (remote) Object.assign(next, remote);
  if (survey.workMode || survey.locations?.length) next.locations = locationList(survey);
  if (survey.pay) {
    next.salary = {
      ...params.salary,
      min: survey.pay.min,
      currency: survey.pay.currency,
    };
  }
  if (survey.licenses?.length) {
    next.requiredSkills = unique([...params.requiredSkills, ...survey.licenses]);
  }
  const occupation = getOccupation(survey.occupationId);
  return withMarketDefaults(next, {
    family: survey.occupationFamily ?? params.occupationFamily ?? null,
    occupationId: survey.occupationId ?? params.occupationId ?? null,
    synonyms:
      survey.occupationSynonyms ??
      (occupation ? occupationSearchTerms(occupation) : []),
  });
}

export type ProfileSummary = {
  role: string | null;
  level: string | null;
  years: number | null;
  skills: string[];
  licenses: string[];
  where: string | null;
  pay: string | null;
};

/** The lines shown on "Here's what we understood". */
export function summarizeProfile(profile: StructuredProfile): ProfileSummary {
  return {
    role: profile.targetRoles[0] ?? profile.currentRole ?? null,
    level: profile.seniority ?? null,
    years: profile.yearsExperience ?? null,
    skills: profile.strongestSkills.slice(0, 6),
    licenses: profile.licenses.slice(0, 6),
    where: profile.preferredLocations.length
      ? profile.preferredLocations.join(", ") +
        (profile.commuteRadiusKm ? ` (up to ${profile.commuteRadiusKm} km)` : "")
      : null,
    pay: formatCompensation(profile.compensation) ?? null,
  };
}

/**
 * Client outreach only makes sense for people who take freelance work.
 * Accounts that never saw the survey keep it (they set it up before).
 */
export function offersFreelance(survey: SurveyAnswers): boolean {
  if (Object.keys(survey).length === 0) return true;
  if (survey.engagement?.length) return survey.engagement.includes("freelance");
  return survey.workType === "contract" || survey.workType === "both";
}
