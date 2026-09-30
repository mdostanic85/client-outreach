import {
  roleWithLevel,
  type RelevantProject,
  type StructuredProfile,
} from "@/modules/profile/schemas";
import {
  TailoredCvSchema,
  type CvExperienceEntry,
  type CvProjectEntry,
  type TailoredCv,
} from "./schemas";

export type ContactHeader = {
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
};

function slugId(prefix: string, value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${prefix}-${slug || "item"}-${index}`;
}

/** Parse "Role at Org", "Role — Org", "Role | Org", "Role @ Org". */
export function parseRoleAtOrganization(title: string): {
  role?: string;
  organization?: string;
} {
  const t = title.trim();
  if (!t) return {};
  const match = t.match(
    /^(.+?)\s+(?:at|@|—|–|-|\||·|•)\s+(.+)$/i,
  );
  if (!match) return {};
  const role = match[1]?.trim();
  const organization = match[2]?.trim();
  if (!role || !organization) return {};
  if (role.length < 2 || organization.length < 2) return {};
  return { role, organization };
}

function experienceFromGeneralProject(
  project: RelevantProject,
  profile: StructuredProfile,
  index: number,
): CvExperienceEntry {
  const parsed = parseRoleAtOrganization(project.title);
  const organization =
    project.organization?.trim() ||
    parsed.organization ||
    project.title.trim();
  const role =
    project.role?.trim() ||
    parsed.role ||
    profile.currentRole?.trim() ||
    "Product / Design";

  const bullets = uniqueStrings([
    ...(project.summary &&
    !looksLikeRoleLine(project.summary, role, organization)
      ? [project.summary]
      : []),
    ...project.outcomes,
  ]).slice(0, 6);

  return {
    id: slugId("exp", `${role}-${organization}`, index),
    organization,
    role,
    location: project.location?.trim() || undefined,
    start: project.start?.trim() || undefined,
    end: project.end?.trim() || undefined,
    bullets,
    sourcePointers: project.sourcePointers,
    included: true,
  };
}

function looksLikeRoleLine(
  summary: string,
  role: string,
  organization: string,
): boolean {
  const n = summary.toLowerCase().trim();
  return (
    n === role.toLowerCase() ||
    n === organization.toLowerCase() ||
    n === `${role} at ${organization}`.toLowerCase()
  );
}

/**
 * Build a deterministic base CV from the approved structured profile.
 * No LLM — personalization patches this later.
 */
export function buildBaseCv(
  profile: StructuredProfile,
  contact: ContactHeader,
): TailoredCv {
  const skills = uniqueStrings([
    ...profile.strongestSkills,
    ...profile.tools,
    ...profile.domainExpertise,
  ]).slice(0, 16);

  const generalWork = profile.relevantProjects.filter(
    (p) => p.evidenceKind === "general",
  );
  const portfolio = profile.relevantProjects.filter(
    (p) => p.evidenceKind !== "general",
  );

  let experience: CvExperienceEntry[] = generalWork.map((project, i) =>
    experienceFromGeneralProject(project, profile, i),
  );

  // Deduplicate near-identical role+org pairs (LinkedIn + CV overlap).
  experience = dedupeExperience(experience);

  if (experience.length === 0 && (profile.achievements.length > 0 || profile.leadershipExperience)) {
    // Single synthetic current-role block from achievements — still grounded.
    const bullets = uniqueStrings([
      ...(profile.leadershipExperience
        ? [profile.leadershipExperience]
        : []),
      ...profile.achievements,
      ...profile.strengthsAndDifferentiators,
    ]).slice(0, 6);

    if (bullets.length > 0) {
      experience.push({
        id: "exp-current-0",
        organization: profile.notableClients[0] ?? "Independent / recent work",
        role: profile.currentRole ?? "Senior Product Designer",
        bullets,
        sourcePointers: ["profile.achievements", "profile.leadershipExperience"],
        included: true,
      });
    }
  }

  // If still empty, create a thin role line so the template isn't blank.
  if (experience.length === 0 && profile.currentRole) {
    experience.push({
      id: "exp-role-0",
      organization: profile.notableClients[0] ?? "Professional experience",
      role: profile.currentRole,
      bullets: profile.strengthsAndDifferentiators.slice(0, 4),
      sourcePointers: ["profile.currentRole"],
      included: true,
    });
  }

  // Keep the career arc — prefer fuller history over aggressive trimming.
  experience = experience.slice(0, 6).map((entry, i) => ({
    ...entry,
    // Most recent roles stay fully visible; older ones stay included with room for bullets.
    included: true,
    bullets: entry.bullets.slice(0, i < 3 ? 5 : 3),
  }));

  const projects: CvProjectEntry[] = portfolio.map((p, i) => ({
    id: slugId("proj", p.title, i),
    title: p.title,
    summary: p.summary,
    outcomes: p.outcomes,
    tools: p.tools,
    sourcePointers: p.sourcePointers,
    included: i < 3,
  }));

  const location =
    contact.location ??
    profile.preferredLocations[0] ??
    profile.timeZones[0] ??
    undefined;

  const headline = roleWithLevel(profile.seniority, profile.currentRole);

  return TailoredCvSchema.parse({
    fullName: contact.fullName.trim() || "Your Name",
    headline: headline || undefined,
    email: contact.email,
    phone: contact.phone,
    location,
    links: contact.links ?? [],
    summary:
      profile.professionalSummary?.trim() ||
      deriveFallbackSummary(profile),
    skills,
    experience,
    projects,
    education: profile.education.slice(0, 4),
    certifications: profile.certifications.slice(0, 4),
    languages: profile.languages.slice(0, 6),
    includeProjects: projects.length > 0,
    includeLanguages: profile.languages.length > 0,
    includeCertifications: profile.certifications.length > 0,
  });
}

function dedupeExperience(entries: CvExperienceEntry[]): CvExperienceEntry[] {
  const out: CvExperienceEntry[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.role.toLowerCase()}::${entry.organization.toLowerCase()}`;
    if (seen.has(key)) {
      const existing = out.find(
        (e) =>
          `${e.role.toLowerCase()}::${e.organization.toLowerCase()}` === key,
      );
      if (existing) {
        existing.bullets = uniqueStrings([
          ...existing.bullets,
          ...entry.bullets,
        ]).slice(0, 6);
        existing.start = existing.start || entry.start;
        existing.end = existing.end || entry.end;
        existing.location = existing.location || entry.location;
        existing.sourcePointers = uniqueStrings([
          ...existing.sourcePointers,
          ...entry.sourcePointers,
        ]);
      }
      continue;
    }
    seen.add(key);
    out.push({ ...entry, bullets: [...entry.bullets] });
  }
  return out;
}

function deriveFallbackSummary(profile: StructuredProfile): string {
  const parts: string[] = [];
  if (profile.currentRole) {
    parts.push(
      profile.yearsExperience != null
        ? `${profile.seniority ? `${profile.seniority} ` : ""}${profile.currentRole} with ${profile.yearsExperience}+ years of experience.`
        : `${profile.seniority ? `${profile.seniority} ` : ""}${profile.currentRole}.`,
    );
  }
  if (profile.strongestSkills.length) {
    parts.push(
      `Core strengths: ${profile.strongestSkills.slice(0, 5).join(", ")}.`,
    );
  }
  if (profile.industries.length) {
    parts.push(`Industries: ${profile.industries.slice(0, 4).join(", ")}.`);
  }
  return parts.join(" ").trim();
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Apply a slot patch onto a base CV without inventing new org/project IDs. */
export function applyCvSlotPatch(
  base: TailoredCv,
  patch: {
    summary?: string;
    skills?: string[];
    experience?: Array<{
      id: string;
      bullets?: string[];
      included?: boolean;
    }>;
    projects?: Array<{
      id: string;
      included?: boolean;
      summary?: string;
    }>;
    includeProjects?: boolean;
    includeLanguages?: boolean;
    includeCertifications?: boolean;
  },
): TailoredCv {
  const expById = new Map(base.experience.map((e) => [e.id, e]));
  const projById = new Map(base.projects.map((p) => [p.id, p]));

  let experience = base.experience.map((entry) => {
    const p = patch.experience?.find((x) => x.id === entry.id);
    if (!p) return entry;
    return {
      ...entry,
      bullets: p.bullets?.length ? p.bullets : entry.bullets,
      included: p.included ?? entry.included,
    };
  });

  // Ignore unknown experience ids from the model.
  for (const p of patch.experience ?? []) {
    if (!expById.has(p.id)) continue;
  }

  // Prefer keeping career history: if the model excluded everything, restore all.
  if (experience.length > 0 && experience.every((e) => !e.included)) {
    experience = experience.map((e) => ({ ...e, included: true }));
  }

  // Always keep at least the two most recent roles when history exists.
  if (experience.length >= 2) {
    const includedCount = experience.filter((e) => e.included).length;
    if (includedCount < 2) {
      experience = experience.map((e, i) =>
        i < 2 ? { ...e, included: true } : e,
      );
    }
  }

  const projects = base.projects.map((entry) => {
    const p = patch.projects?.find((x) => x.id === entry.id);
    if (!p) return entry;
    return {
      ...entry,
      summary: p.summary ?? entry.summary,
      included: p.included ?? entry.included,
    };
  });

  for (const p of patch.projects ?? []) {
    if (!projById.has(p.id)) continue;
  }

  // Skills: only keep strings that appear in the base skill universe
  // (case-insensitive), preserving requested order.
  let skills = base.skills;
  if (patch.skills?.length) {
    const allowed = new Map(
      base.skills.map((s) => [s.toLowerCase(), s] as const),
    );
    const ordered: string[] = [];
    for (const s of patch.skills) {
      const orig = allowed.get(s.trim().toLowerCase());
      if (orig && !ordered.includes(orig)) ordered.push(orig);
    }
    // Append any base skills not selected so we don't lose inventory in editor.
    for (const s of base.skills) {
      if (!ordered.includes(s)) ordered.push(s);
    }
    skills = ordered.slice(0, 14);
  }

  return TailoredCvSchema.parse({
    ...base,
    summary: patch.summary?.trim() || base.summary,
    skills,
    experience,
    projects,
    includeProjects: patch.includeProjects ?? base.includeProjects,
    includeLanguages: patch.includeLanguages ?? base.includeLanguages,
    includeCertifications:
      patch.includeCertifications ?? base.includeCertifications,
  });
}
