import {
  formatCompensation,
  resolveCompensation,
  type CompensationExpectation,
  type StructuredProfile,
} from "./schemas";

/**
 * The editable slice of a structured profile as the Profile form holds it:
 * lists as one item per line, numbers and JSON as raw text. Everything the
 * form does not show is carried over from the profile being edited.
 */
export type ProfileFormValues = {
  currentRole: string;
  seniority: string;
  yearsExperience: string;
  availability: string;
  targetRoles: string;
  preferredLocations: string;
  strongestSkills: string;
  strengthsAndDifferentiators: string;
  industries: string;
  productTypes: string;
  tools: string;
  licenses: string;
  leadershipExperience: string;
  compensation: CompensationExpectation;
  preferredEmploymentTypes: string;
  timeZones: string;
  languages: string;
  rolesBelowLevel: string;
  rolesAboveLevel: string;
  projectsJson: string;
};

export function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listToLines(value: string[] | undefined): string {
  return (value ?? []).join("\n");
}

export function profileToFormValues(profile: StructuredProfile): ProfileFormValues {
  return {
    currentRole: profile.currentRole ?? "",
    seniority: profile.seniority ?? "",
    yearsExperience: profile.yearsExperience != null ? String(profile.yearsExperience) : "",
    availability: profile.availability ?? "",
    targetRoles: listToLines(profile.targetRoles),
    preferredLocations: listToLines(profile.preferredLocations),
    strongestSkills: listToLines(profile.strongestSkills),
    strengthsAndDifferentiators: listToLines(profile.strengthsAndDifferentiators),
    industries: listToLines(profile.industries),
    productTypes: listToLines(profile.productTypes),
    tools: listToLines(profile.tools),
    licenses: listToLines(profile.licenses),
    leadershipExperience: profile.leadershipExperience ?? "",
    compensation: resolveCompensation(profile),
    preferredEmploymentTypes: listToLines(profile.preferredEmploymentTypes),
    timeZones: listToLines(profile.timeZones),
    languages: listToLines(profile.languages),
    rolesBelowLevel: listToLines(profile.rolesBelowLevel),
    rolesAboveLevel: listToLines(profile.rolesAboveLevel),
    projectsJson: JSON.stringify(profile.relevantProjects ?? [], null, 2),
  };
}

/**
 * Applies the form to `base` (the profile being edited). Throws a message the
 * user can act on when the years or the projects JSON do not parse.
 */
export function formValuesToProfile(
  values: ProfileFormValues,
  base: StructuredProfile,
): StructuredProfile {
  let relevantProjects = base.relevantProjects ?? [];
  try {
    relevantProjects = JSON.parse(values.projectsJson || "[]");
  } catch {
    throw new Error("Projects JSON is invalid");
  }
  const yearsText = values.yearsExperience.trim();
  const years = yearsText ? Number(yearsText) : null;
  if (yearsText && Number.isNaN(years)) {
    throw new Error("Years experience must be a number");
  }
  const { compensation } = values;

  return {
    ...base,
    currentRole: values.currentRole.trim() || undefined,
    seniority: values.seniority.trim() || undefined,
    yearsExperience: years,
    strongestSkills: linesToList(values.strongestSkills),
    industries: linesToList(values.industries),
    productTypes: linesToList(values.productTypes),
    relevantProjects,
    tools: linesToList(values.tools),
    licenses: linesToList(values.licenses),
    leadershipExperience: values.leadershipExperience.trim() || undefined,
    preferredEmploymentTypes: linesToList(values.preferredEmploymentTypes),
    preferredLocations: linesToList(values.preferredLocations),
    timeZones: linesToList(values.timeZones),
    compensation:
      compensation.min != null || compensation.max != null ? compensation : undefined,
    salaryOrRateExpectations: formatCompensation(compensation),
    availability: values.availability.trim() || undefined,
    strengthsAndDifferentiators: linesToList(values.strengthsAndDifferentiators),
    targetRoles: linesToList(values.targetRoles),
    rolesBelowLevel: linesToList(values.rolesBelowLevel),
    rolesAboveLevel: linesToList(values.rolesAboveLevel),
    languages: linesToList(values.languages),
    groundingNotes: base.groundingNotes ?? [],
    fieldSources: base.fieldSources ?? {},
    education: base.education ?? [],
    certifications: base.certifications ?? [],
    notableClients: base.notableClients ?? [],
    achievements: base.achievements ?? [],
    domainExpertise: base.domainExpertise ?? [],
    professionalSummary: base.professionalSummary,
    workingStyle: base.workingStyle,
  };
}
