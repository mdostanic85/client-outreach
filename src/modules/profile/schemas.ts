import { z } from "zod";

export const ProfileSourceTypeSchema = z.enum([
  "cv",
  "portfolio_url",
  "linkedin_text",
  "manual",
  "document",
  "github",
]);

export type ProfileSourceType = z.infer<typeof ProfileSourceTypeSchema>;

export const RelevantProjectSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  outcomes: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  sourcePointers: z.array(z.string()).default([]),
  /**
   * portfolio_project = case-study evidence (gated by matching toggle).
   * general = work history / product work that stays in the Professional Profile
   * and can still inform matching when portfolio projects are disabled.
   */
  evidenceKind: z
    .enum(["portfolio_project", "general"])
    .default("portfolio_project"),
  /** Employer / organization — preferred for evidenceKind "general". */
  organization: z.string().optional(),
  /** Job title / role — preferred for evidenceKind "general". */
  role: z.string().optional(),
  /** Start date label as written in sources (e.g. "Jan 2021", "2021"). */
  start: z.string().optional(),
  /** End date label or "Present" / "Current". */
  end: z.string().optional(),
  location: z.string().optional(),
});

export type RelevantProject = z.infer<typeof RelevantProjectSchema>;

export const COMPENSATION_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "RSD",
] as const;

export type CompensationCurrency =
  (typeof COMPENSATION_CURRENCIES)[number];

export const CompensationExpectationSchema = z.object({
  /** Fixed annual/monthly salary vs hourly rate. */
  mode: z.enum(["salary", "hourly"]).default("salary"),
  currency: z.enum(COMPENSATION_CURRENCIES).default("EUR"),
  min: z.number().nonnegative().nullable().optional(),
  max: z.number().nonnegative().nullable().optional(),
});

export type CompensationExpectation = z.infer<
  typeof CompensationExpectationSchema
>;

export const EMPTY_COMPENSATION: CompensationExpectation = {
  mode: "salary",
  currency: "EUR",
  min: null,
  max: null,
};

export function formatCompensation(
  value: CompensationExpectation | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const min = value.min ?? null;
  const max = value.max ?? null;
  if (min == null && max == null) return undefined;

  const period = value.mode === "hourly" ? "hour" : "year";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  let amount: string;
  if (min != null && max != null && min !== max) {
    amount = `${fmt(min)}–${fmt(max)}`;
  } else {
    amount = fmt(min ?? max ?? 0);
  }
  return `${value.currency} ${amount} / ${period}`;
}

export function parseCompensationText(
  raw: string | null | undefined,
): CompensationExpectation | null {
  const text = raw?.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const mode: CompensationExpectation["mode"] =
    /\/\s*h(ou)?r\b|\bhourly\b|\bsat\b|\b\/hr\b/.test(lower)
      ? "hourly"
      : "salary";

  let currency: CompensationCurrency = "EUR";
  if (/\bUSD\b|\$/.test(text)) currency = "USD";
  else if (/\bGBP\b|£/.test(text)) currency = "GBP";
  else if (/\bCHF\b/.test(text)) currency = "CHF";
  else if (/\bRSD\b/.test(text)) currency = "RSD";
  else if (/\bEUR\b|€/.test(text)) currency = "EUR";

  const numberMatches = [
    ...text.matchAll(/(\d[\d.,]*)\s*([kK])?/g),
  ].map((m) => {
    const base = Number(String(m[1]).replace(/,/g, ""));
    if (Number.isNaN(base)) return null;
    return m[2] ? base * 1000 : base;
  }).filter((n): n is number => n != null && n > 0);

  if (numberMatches.length === 0) return null;

  const min = numberMatches[0] ?? null;
  const max =
    numberMatches.length > 1
      ? numberMatches[numberMatches.length - 1]!
      : min;

  return { mode, currency, min, max };
}

export const StructuredProfileSchema = z.object({
  currentRole: z.string().optional(),
  seniority: z.string().optional(),
  yearsExperience: z.number().nullable().optional(),
  strongestSkills: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  productTypes: z.array(z.string()).default([]),
  relevantProjects: z.array(RelevantProjectSchema).default([]),
  designTools: z.array(z.string()).default([]),
  technicalTools: z.array(z.string()).default([]),
  leadershipExperience: z.string().optional(),
  preferredEmploymentTypes: z.array(z.string()).default([]),
  preferredLocations: z.array(z.string()).default([]),
  timeZones: z.array(z.string()).default([]),
  /** Structured rate/salary; preferred over free-text. */
  compensation: CompensationExpectationSchema.optional(),
  /** Human-readable summary, kept in sync from `compensation` when set in UI. */
  salaryOrRateExpectations: z.string().optional(),
  availability: z.string().optional(),
  strengthsAndDifferentiators: z.array(z.string()).default([]),
  targetRoles: z.array(z.string()).default([]),
  rolesBelowLevel: z.array(z.string()).default([]),
  rolesAboveLevel: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  /** Grounding notes from the model — not user-facing claims. */
  groundingNotes: z.array(z.string()).default([]),
  /**
   * Field → human source labels (e.g. currentRole: ["LinkedIn", "Portfolio"]).
   * Used for attribution in the Professional Profile UI; matching may consult it later.
   */
  fieldSources: z.record(z.string(), z.array(z.string())).default({}),
  /** Free-form professional summary / biography when extracted. */
  professionalSummary: z.string().optional(),
  /** Education entries (plain strings for MVP). */
  education: z.array(z.string()).default([]),
  /** Certifications. */
  certifications: z.array(z.string()).default([]),
  /** Notable clients. */
  notableClients: z.array(z.string()).default([]),
  /** Achievements / highlights. */
  achievements: z.array(z.string()).default([]),
  /** Working style notes. */
  workingStyle: z.string().optional(),
  /** Domain expertise tags. */
  domainExpertise: z.array(z.string()).default([]),
});

export type StructuredProfile = z.infer<typeof StructuredProfileSchema>;

export function resolveCompensation(
  profile: Pick<
    StructuredProfile,
    "compensation" | "salaryOrRateExpectations"
  >,
): CompensationExpectation {
  if (profile.compensation) {
    return CompensationExpectationSchema.parse(profile.compensation);
  }
  return (
    parseCompensationText(profile.salaryOrRateExpectations) ?? {
      ...EMPTY_COMPENSATION,
    }
  );
}

export const EMPTY_STRUCTURED_PROFILE: StructuredProfile = {
  strongestSkills: [],
  industries: [],
  productTypes: [],
  relevantProjects: [],
  designTools: [],
  technicalTools: [],
  preferredEmploymentTypes: [],
  preferredLocations: [],
  timeZones: [],
  strengthsAndDifferentiators: [],
  targetRoles: [],
  rolesBelowLevel: [],
  rolesAboveLevel: [],
  languages: [],
  groundingNotes: [],
  fieldSources: {},
  education: [],
  certifications: [],
  notableClients: [],
  achievements: [],
  domainExpertise: [],
};

export function parseStructuredProfile(json: string): StructuredProfile {
  return StructuredProfileSchema.parse(JSON.parse(json || "{}"));
}

export function derivePositioningSummary(profile: StructuredProfile): string {
  const lines: string[] = [];
  if (profile.currentRole) {
    lines.push(
      profile.seniority
        ? `${profile.seniority} ${profile.currentRole}`
        : profile.currentRole,
    );
  }
  if (profile.yearsExperience != null) {
    lines.push(`${profile.yearsExperience}+ years experience`);
  }
  if (profile.strongestSkills.length) {
    lines.push(`Strongest skills: ${profile.strongestSkills.slice(0, 8).join(", ")}`);
  }
  if (profile.strengthsAndDifferentiators.length) {
    lines.push(profile.strengthsAndDifferentiators.slice(0, 3).join("; "));
  }
  if (profile.targetRoles.length) {
    lines.push(`Target roles: ${profile.targetRoles.slice(0, 5).join(", ")}`);
  }
  if (profile.preferredEmploymentTypes.length) {
    lines.push(
      `Open to: ${profile.preferredEmploymentTypes.join(", ")}`,
    );
  }
  const pay = formatCompensation(
    profile.compensation ??
      parseCompensationText(profile.salaryOrRateExpectations) ??
      undefined,
  );
  if (pay) {
    lines.push(`Compensation: ${pay}`);
  } else if (profile.salaryOrRateExpectations) {
    lines.push(`Compensation: ${profile.salaryOrRateExpectations}`);
  }
  if (profile.availability) {
    lines.push(`Availability: ${profile.availability}`);
  }
  return lines.join("\n");
}

/** "Senior" + "Product Designer" → "Senior Product Designer", without doubling a level already in the title. */
export function roleWithLevel(
  level: string | null | undefined,
  role: string | null | undefined,
): string {
  const r = role?.trim() ?? "";
  const l = level?.trim() ?? "";
  if (!l) return r;
  if (!r) return l;
  return r.toLowerCase().includes(l.toLowerCase()) ? r : `${l} ${r}`;
}
