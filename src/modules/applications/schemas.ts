import { z } from "zod";

export const PackageMarketSchema = z.enum(["us", "europe"]);
export type PackageMarket = z.infer<typeof PackageMarketSchema>;

export const PackageStateSchema = z.enum([
  "draft",
  "approved",
  "prepared",
  "superseded",
]);
export type PackageState = z.infer<typeof PackageStateSchema>;

export const PackageMailStatusSchema = z.enum([
  "none",
  "sent",
  "waiting",
  "follow_up",
  "closed",
]);
export type PackageMailStatus = z.infer<typeof PackageMailStatusSchema>;

export const CvExperienceEntrySchema = z.object({
  id: z.string(),
  organization: z.string(),
  role: z.string(),
  location: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  /** Profile source pointers for grounding. */
  sourcePointers: z.array(z.string()).default([]),
  included: z.boolean().default(true),
});

export const CvProjectEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  outcomes: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  sourcePointers: z.array(z.string()).default([]),
  included: z.boolean().default(true),
});

export const TailoredCvSchema = z.object({
  fullName: z.string(),
  headline: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  links: z.array(z.string()).default([]),
  summary: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(CvExperienceEntrySchema).default([]),
  projects: z.array(CvProjectEntrySchema).default([]),
  education: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  includeProjects: z.boolean().default(true),
  includeLanguages: z.boolean().default(true),
  includeCertifications: z.boolean().default(true),
});

export type TailoredCv = z.infer<typeof TailoredCvSchema>;
export type CvExperienceEntry = z.infer<typeof CvExperienceEntrySchema>;
export type CvProjectEntry = z.infer<typeof CvProjectEntrySchema>;

export const CoverLetterSchema = z.object({
  greeting: z.string().default("Dear Hiring Team,"),
  opening: z.string().default(""),
  body: z.string().default(""),
  closing: z.string().default(""),
  signOff: z.string().default("Best regards,"),
  fullName: z.string().default(""),
});

export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export const PackageAnalysisSchema = z.object({
  roleSummary: z.string().default(""),
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
  fitStrengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  recommendedSkillOrder: z.array(z.string()).default([]),
  recommendedProjectIds: z.array(z.string()).default([]),
  recommendedBulletIds: z.array(z.string()).default([]),
  suggestedMarket: PackageMarketSchema.optional(),
});

export type PackageAnalysis = z.infer<typeof PackageAnalysisSchema>;

export const PackageWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warn", "block"]).default("warn"),
});

export type PackageWarning = z.infer<typeof PackageWarningSchema>;

export const GroundingReportSchema = z.object({
  ok: z.boolean(),
  usedFields: z.array(z.string()).default([]),
  usedProjectIds: z.array(z.string()).default([]),
  usedCompanyFacts: z.array(z.string()).default([]),
  rejectedClaims: z.array(z.string()).default([]),
});

export type GroundingReport = z.infer<typeof GroundingReportSchema>;

/** LLM slot-patch output — partial CV updates only. */
export const CvSlotPatchSchema = z.object({
  summary: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experience: z
    .array(
      z.object({
        id: z.string(),
        bullets: z.array(z.string()).optional(),
        included: z.boolean().optional(),
      }),
    )
    .optional(),
  projects: z
    .array(
      z.object({
        id: z.string(),
        included: z.boolean().optional(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  includeProjects: z.boolean().optional(),
  includeLanguages: z.boolean().optional(),
  includeCertifications: z.boolean().optional(),
});

export type CvSlotPatch = z.infer<typeof CvSlotPatchSchema>;

export function parseTailoredCv(json: string): TailoredCv {
  return TailoredCvSchema.parse(JSON.parse(json || "{}"));
}

export function parseCoverLetterFromText(text: string): CoverLetter {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "opening" in parsed) {
      return CoverLetterSchema.parse(parsed);
    }
  } catch {
    // plain text fallback
  }
  return CoverLetterSchema.parse({
    opening: text.trim(),
    body: "",
    closing: "",
  });
}

export function coverLetterToPlainText(letter: CoverLetter): string {
  return [
    letter.greeting,
    "",
    letter.opening,
    "",
    letter.body,
    "",
    letter.closing,
    "",
    letter.signOff,
    letter.fullName,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function serializeCoverLetter(letter: CoverLetter): string {
  return JSON.stringify(letter);
}
