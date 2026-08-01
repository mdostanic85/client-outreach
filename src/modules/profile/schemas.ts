import { z } from "zod";

export const ProfileSourceTypeSchema = z.enum([
  "cv",
  "portfolio_url",
  "linkedin_text",
  "manual",
  "document",
]);

export type ProfileSourceType = z.infer<typeof ProfileSourceTypeSchema>;

export const RelevantProjectSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  outcomes: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  sourcePointers: z.array(z.string()).default([]),
});

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
  salaryOrRateExpectations: z.string().optional(),
  availability: z.string().optional(),
  strengthsAndDifferentiators: z.array(z.string()).default([]),
  targetRoles: z.array(z.string()).default([]),
  rolesBelowLevel: z.array(z.string()).default([]),
  rolesAboveLevel: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  /** Grounding notes from the model — not user-facing claims. */
  groundingNotes: z.array(z.string()).default([]),
});

export type StructuredProfile = z.infer<typeof StructuredProfileSchema>;

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
  if (profile.availability) {
    lines.push(`Availability: ${profile.availability}`);
  }
  return lines.join("\n");
}
