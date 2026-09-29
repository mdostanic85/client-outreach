import type { StructuredProfile } from "@/modules/profile/schemas";
import type {
  CoverLetter,
  GroundingReport,
  PackageWarning,
  TailoredCv,
} from "./schemas";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function profileCorpus(profile: StructuredProfile): string {
  const chunks: string[] = [
    profile.currentRole ?? "",
    profile.professionalSummary ?? "",
    profile.leadershipExperience ?? "",
    profile.workingStyle ?? "",
    ...profile.strongestSkills,
    ...profile.designTools,
    ...profile.technicalTools,
    ...profile.industries,
    ...profile.productTypes,
    ...profile.achievements,
    ...profile.strengthsAndDifferentiators,
    ...profile.education,
    ...profile.certifications,
    ...profile.notableClients,
    ...profile.languages,
    ...profile.domainExpertise,
  ];
  for (const p of profile.relevantProjects) {
    chunks.push(
      p.title,
      p.summary ?? "",
      p.organization ?? "",
      p.role ?? "",
      p.start ?? "",
      p.end ?? "",
      p.location ?? "",
      ...p.outcomes,
      ...p.tools,
    );
  }
  return normalize(chunks.join("\n"));
}

/**
 * Lightweight grounding: reject org/project titles and bold metric claims
 * that do not appear in the approved profile corpus.
 */
export function validateGrounding(input: {
  profile: StructuredProfile;
  cv: TailoredCv;
  letter: CoverLetter;
  companyName?: string | null;
  jobTitle?: string | null;
}): GroundingReport {
  const corpus = profileCorpus(input.profile);
  const rejected: string[] = [];
  const usedFields: string[] = [];
  const usedProjectIds: string[] = [];

  if (input.cv.summary) usedFields.push("professionalSummary");
  if (input.cv.skills.length) usedFields.push("strongestSkills");
  if (input.cv.education.length) usedFields.push("education");

  for (const exp of input.cv.experience) {
    if (!exp.included) continue;
    usedFields.push(`experience:${exp.id}`);
    // Organization names from base-cv are already profile-derived; still check
    // that we didn't invent a new employer string via patch.
    const org = normalize(exp.organization);
    if (
      org &&
      org !== "professional experience" &&
      org !== "independent / recent work" &&
      !corpus.includes(org) &&
      !input.profile.notableClients.some((c) => normalize(c).includes(org))
    ) {
      // Soft: allow title-as-org / structured organization from projects
      const projectMatch = input.profile.relevantProjects.some((p) => {
        if (normalize(p.title) === org) return true;
        if (p.organization && normalize(p.organization) === org) return true;
        if (normalize(p.title).includes(org)) return true;
        return false;
      });
      if (!projectMatch) {
        rejected.push(`Unknown organization on CV: ${exp.organization}`);
      }
    }
  }

  for (const proj of input.cv.projects) {
    if (!proj.included) continue;
    usedProjectIds.push(proj.id);
    const title = normalize(proj.title);
    const known = input.profile.relevantProjects.some(
      (p) => normalize(p.title) === title,
    );
    if (!known) {
      rejected.push(`Unknown project on CV: ${proj.title}`);
    }
  }

  // Skill inventions
  const allowedSkills = new Set(
    [
      ...input.profile.strongestSkills,
      ...input.profile.designTools,
      ...input.profile.technicalTools,
      ...input.profile.domainExpertise,
    ].map(normalize),
  );
  for (const skill of input.cv.skills) {
    if (!allowedSkills.has(normalize(skill))) {
      rejected.push(`Skill not in approved profile: ${skill}`);
    }
  }

  const texts = {
    "cover letter": [input.letter.opening, input.letter.body, input.letter.closing].join(" "),
    "CV": [input.cv.summary,
      ...input.cv.experience.filter(e => e.included).flatMap(e => e.bullets),
      ...(input.cv.includeProjects ? input.cv.projects.filter(p => p.included).flatMap(p => [p.summary ?? "", ...p.outcomes]) : []),
    ].join(" "),
  };
  const metricPattern = /\b\d+(?:[.,]\d+)?%|[$€£]\d[\d,.]*\b|\b\d+(?:[.,]\d+)?x\b|\b\d[\d,.]*\s*(?:users|customers|mrr|arr)\b/gi;
  const approvedMetrics = new Set((corpus.match(metricPattern) ?? []).map(normalize));
  for (const [label, text] of Object.entries(texts)) {
    for (const metric of normalize(text).match(metricPattern) ?? []) {
      if (!approvedMetrics.has(normalize(metric))) rejected.push(`Unverified metric in ${label}: ${metric}`);
    }
  }

  const usedCompanyFacts: string[] = [];
  if (input.companyName) usedCompanyFacts.push(`company:${input.companyName}`);
  if (input.jobTitle) usedCompanyFacts.push(`role:${input.jobTitle}`);

  return {
    ok: rejected.length === 0,
    usedFields,
    usedProjectIds,
    usedCompanyFacts,
    rejectedClaims: rejected,
  };
}

export function buildPackageWarnings(input: {
  hasDescription: boolean;
  projectCount: number;
  experienceCount: number;
  gaps: string[];
  grounding: GroundingReport;
  marketConfirmed: boolean;
}): PackageWarning[] {
  const warnings: PackageWarning[] = [];

  if (!input.hasDescription) {
    warnings.push({
      code: "thin_jd",
      message:
        "Job description is thin or missing. CV emphasis may be less precise.",
      severity: "warn",
    });
  }
  if (input.projectCount === 0 && input.experienceCount === 0) {
    warnings.push({
      code: "thin_profile",
      message:
        "Approved profile has little experience/project evidence. Add facts on Profile before applying.",
      severity: "block",
    });
  } else if (input.projectCount === 0) {
    warnings.push({
      code: "no_projects",
      message: "No portfolio projects in profile — Selected work section is empty.",
      severity: "info",
    });
  }
  if (input.gaps.length) {
    warnings.push({
      code: "match_gaps",
      message: `Gaps vs role: ${input.gaps.slice(0, 3).join("; ")}`,
      severity: "warn",
    });
  }
  if (!input.grounding.ok) {
    warnings.push({
      code: "grounding_failed",
      message: `Grounding rejected ${input.grounding.rejectedClaims.length} claim(s). Review Evidence tab.`,
      severity: "block",
    });
  }
  if (!input.marketConfirmed) {
    warnings.push({
      code: "market_suggested",
      message: "Market was auto-suggested from location signals — confirm US vs Europe.",
      severity: "info",
    });
  }

  return warnings;
}
