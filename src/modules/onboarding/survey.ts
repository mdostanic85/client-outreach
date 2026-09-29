import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { owned } from "@/modules/auth/current-user";
import {
  COMPENSATION_CURRENCIES,
  formatCompensation,
  type StructuredProfile,
} from "@/modules/profile/schemas";
import type { JobSearchParams } from "@/modules/search-profile/schemas";
import { getUserSettings } from "@/modules/settings/user-settings";

export const WORK_TYPES = ["full_time", "contract", "both"] as const;
export const LEVELS = ["junior", "mid", "senior", "lead", "head"] as const;
export const WORK_MODES = ["remote", "hybrid", "onsite", "any"] as const;
export const AVAILABILITY = ["now", "soon", "exploring"] as const;
export const PRIORITIES = [
  "pay",
  "flexibility",
  "product",
  "team",
  "growth",
  "mission",
  "balance",
  "stability",
] as const;

export const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead",
  head: "Head / Director",
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
};

const AVAILABILITY_LABELS: Record<(typeof AVAILABILITY)[number], string> = {
  now: "Available now",
  soon: "Available in 1–2 months",
  exploring: "Open to the right role",
};

export const SurveySchema = z.object({
  workType: z.enum(WORK_TYPES).optional(),
  role: z.string().trim().max(80).optional(),
  level: z.enum(LEVELS).optional(),
  workMode: z.enum(WORK_MODES).optional(),
  locations: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
  pay: z
    .object({
      mode: z.enum(["salary", "hourly"]),
      currency: z.enum(COMPENSATION_CURRENCIES),
      min: z.number().positive().max(10_000_000),
    })
    .nullable()
    .optional(),
  availability: z.enum(AVAILABILITY).optional(),
  priorities: z.array(z.enum(PRIORITIES)).max(3).optional(),
  websiteUrl: z.string().trim().max(300).optional(),
});

export type SurveyAnswers = z.infer<typeof SurveySchema>;

export async function getSurvey(): Promise<SurveyAnswers> {
  const row = await getUserSettings();
  try {
    return SurveySchema.parse(JSON.parse(row.surveyJson || "{}"));
  } catch {
    return {};
  }
}

/** Merges one screen's answer into the stored survey. */
export async function saveSurveyPatch(patch: SurveyAnswers): Promise<SurveyAnswers> {
  const row = await getUserSettings();
  const next = SurveySchema.parse({ ...(await getSurvey()), ...patch });
  await getDb()
    .update(settings)
    .set({ surveyJson: JSON.stringify(next), updatedAt: nowIso() })
    .where(and(await owned(settings), eq(settings.id, row.id)));
  return next;
}

function unique(values: Array<string | undefined>): string[] {
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

function employmentTypes(workType: SurveyAnswers["workType"]): string[] {
  if (workType === "full_time") return ["Full-time"];
  if (workType === "contract") return ["Contract", "Freelance"];
  return ["Full-time", "Contract"];
}

function locationList(survey: SurveyAnswers): string[] {
  const picked = survey.locations ?? [];
  if (survey.workMode === "remote") return unique(["Remote", ...picked]);
  return picked.length ? picked : ["Remote"];
}

/** What the user told us wins over what the model read from the CV. */
export function applySurveyToProfile(
  profile: StructuredProfile,
  survey: SurveyAnswers,
): StructuredProfile {
  const next: StructuredProfile = { ...profile };
  if (survey.role) next.targetRoles = unique([survey.role, ...profile.targetRoles]);
  if (survey.level) next.seniority = LEVEL_LABELS[survey.level];
  if (survey.workType) next.preferredEmploymentTypes = employmentTypes(survey.workType);
  if (survey.workMode || survey.locations?.length) {
    next.preferredLocations = locationList(survey);
  }
  if (survey.pay) {
    next.compensation = {
      mode: survey.pay.mode,
      currency: survey.pay.currency,
      min: survey.pay.min,
      max: null,
    };
  }
  if (survey.availability) next.availability = AVAILABILITY_LABELS[survey.availability];
  if (survey.priorities?.length) {
    const labels = survey.priorities.map((p) => PRIORITY_LABELS[p]).join(", ");
    next.workingStyle = unique([profile.workingStyle, `Priorities: ${labels}`]).join(" · ");
  }
  return next;
}

export function applySurveyToSearchParams(
  params: JobSearchParams,
  survey: SurveyAnswers,
): JobSearchParams {
  const next: JobSearchParams = { ...params };
  if (survey.role) next.targetTitles = unique([survey.role, ...params.targetTitles]);
  if (survey.level) next.seniority = [LEVEL_LABELS[survey.level]];
  if (survey.workType) next.employmentTypes = employmentTypes(survey.workType);
  if (survey.workMode) {
    next.remoteRequired = survey.workMode === "remote";
    next.remotePolicy =
      survey.workMode === "remote"
        ? "remote_ok_required"
        : survey.workMode === "hybrid"
          ? "remote_preferred"
          : "any";
  }
  if (survey.workMode || survey.locations?.length) next.locations = locationList(survey);
  if (survey.pay) {
    next.salary = {
      ...params.salary,
      min: survey.pay.min,
      currency: survey.pay.currency,
    };
  }
  return next;
}

export type ProfileSummary = {
  role: string | null;
  level: string | null;
  years: number | null;
  skills: string[];
  where: string | null;
  pay: string | null;
};

/** The five lines shown on "Here's what we understood". */
export function summarizeProfile(profile: StructuredProfile): ProfileSummary {
  return {
    role: profile.targetRoles[0] ?? profile.currentRole ?? null,
    level: profile.seniority ?? null,
    years: profile.yearsExperience ?? null,
    skills: profile.strongestSkills.slice(0, 6),
    where: profile.preferredLocations.length
      ? profile.preferredLocations.join(", ")
      : null,
    pay: formatCompensation(profile.compensation) ?? null,
  };
}

/** Where a returning user picks up: first unanswered question, or the next stage. */
export function firstOpenQuestion(
  survey: SurveyAnswers,
): "intro" | "workType" | "role" | "level" | "workMode" | "location" | "pay" | "availability" | "priorities" | null {
  if (Object.keys(survey).length === 0) return "intro";
  if (!survey.workType) return "workType";
  if (!survey.role) return "role";
  if (!survey.level) return "level";
  if (!survey.workMode) return "workMode";
  if (!survey.locations) return "location";
  if (survey.pay === undefined) return "pay";
  if (!survey.availability) return "availability";
  if (!survey.priorities) return "priorities";
  return null;
}
