import {
  formatCompensation,
  type StructuredProfile,
} from "./schemas";

export type DiffCategory =
  | "new"
  | "updated"
  | "conflict"
  | "unchanged"
  | "uncertain"
  | "missing";

export type ProfileDiffItem = {
  id: string;
  category: DiffCategory;
  /** Human section label */
  section: string;
  /** Field key on StructuredProfile or special path */
  field: string;
  /** List item index when applicable */
  index?: number;
  /** Project title key when field === relevantProjects */
  projectTitle?: string;
  label: string;
  previous?: string;
  next?: string;
  sources?: string[];
  note?: string;
};

export type ProfileDiff = {
  items: ProfileDiffItem[];
  counts: Record<DiffCategory, number>;
};

const SCALAR_FIELDS: Array<{
  field: keyof StructuredProfile;
  section: string;
  label: string;
}> = [
  { field: "currentRole", section: "Identity", label: "Professional title" },
  { field: "seniority", section: "Identity", label: "Seniority" },
  {
    field: "yearsExperience",
    section: "Identity",
    label: "Years of experience",
  },
  {
    field: "professionalSummary",
    section: "Identity",
    label: "Professional summary",
  },
  {
    field: "leadershipExperience",
    section: "Identity",
    label: "Leadership experience",
  },
  { field: "workingStyle", section: "Identity", label: "Working style" },
  { field: "availability", section: "Preferences", label: "Availability" },
];

const LIST_FIELDS: Array<{
  field: keyof StructuredProfile;
  section: string;
  label: string;
}> = [
  { field: "strongestSkills", section: "Skills", label: "Core skill" },
  { field: "tools", section: "Skills", label: "Tool" },
  { field: "licenses", section: "Skills", label: "Licence" },
  { field: "industries", section: "Background", label: "Industry" },
  { field: "productTypes", section: "Background", label: "Product type" },
  { field: "domainExpertise", section: "Background", label: "Domain expertise" },
  { field: "education", section: "Background", label: "Education" },
  { field: "certifications", section: "Background", label: "Certification" },
  { field: "notableClients", section: "Background", label: "Notable client" },
  { field: "achievements", section: "Background", label: "Achievement" },
  { field: "languages", section: "Background", label: "Language" },
  {
    field: "strengthsAndDifferentiators",
    section: "Background",
    label: "Strength",
  },
  { field: "targetRoles", section: "Preferences", label: "Preferred role" },
  {
    field: "preferredEmploymentTypes",
    section: "Preferences",
    label: "Job type",
  },
  {
    field: "preferredLocations",
    section: "Preferences",
    label: "Preferred location",
  },
  { field: "timeZones", section: "Preferences", label: "Timezone" },
  {
    field: "rolesBelowLevel",
    section: "Preferences",
    label: "Role below level",
  },
  {
    field: "rolesAboveLevel",
    section: "Preferences",
    label: "Role above level",
  },
];

function norm(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

function listOf(profile: StructuredProfile, field: keyof StructuredProfile): string[] {
  const raw = profile[field];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function lookAlike(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, " ").trim();
  const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function emptyBaseline(profile: StructuredProfile | null | undefined): boolean {
  if (!profile) return true;
  return (
    !profile.currentRole &&
    !profile.professionalSummary &&
    profile.strongestSkills.length === 0 &&
    profile.relevantProjects.length === 0
  );
}

/**
 * Diff an incoming extracted/edited profile against the baseline (approved).
 * Used for import review before the user commits facts.
 */
export function diffStructuredProfiles(
  baseline: StructuredProfile | null | undefined,
  incoming: StructuredProfile,
): ProfileDiff {
  const items: ProfileDiffItem[] = [];
  const base = baseline ?? null;
  const firstImport = emptyBaseline(base);

  for (const meta of SCALAR_FIELDS) {
    const prev = base ? norm(base[meta.field]) : "";
    const next = norm(incoming[meta.field]);
    if (!prev && !next) continue;

    const sources = incoming.fieldSources?.[meta.field as string];
    let category: DiffCategory;
    if (!prev && next) category = firstImport ? "new" : "new";
    else if (prev && !next) category = "missing";
    else if (prev === next) category = "unchanged";
    else if (lookAlike(prev, next)) category = "updated";
    else category = "conflict";

    if (category === "unchanged") continue;

    items.push({
      id: `scalar:${meta.field}`,
      category,
      section: meta.section,
      field: meta.field as string,
      label: meta.label,
      previous: prev || undefined,
      next: next || undefined,
      sources,
      note:
        category === "conflict"
          ? "Existing and imported values differ — pick which to keep."
          : category === "missing"
            ? "This fact exists in your profile but was not found in the new import."
            : undefined,
    });
  }

  // Compensation
  {
    const prev =
      formatCompensation(base?.compensation) ??
      base?.salaryOrRateExpectations?.trim() ??
      "";
    const next =
      formatCompensation(incoming.compensation) ??
      incoming.salaryOrRateExpectations?.trim() ??
      "";
    if (prev || next) {
      let category: DiffCategory;
      if (!prev && next) category = "new";
      else if (prev && !next) category = "missing";
      else if (prev === next) category = "unchanged";
      else category = "conflict";
      if (category !== "unchanged") {
        items.push({
          id: "scalar:compensation",
          category,
          section: "Preferences",
          field: "compensation",
          label: "Salary or rate",
          previous: prev || undefined,
          next: next || undefined,
          sources: incoming.fieldSources?.compensation,
        });
      }
    }
  }

  for (const meta of LIST_FIELDS) {
    const prevItems = base ? listOf(base, meta.field) : [];
    const nextItems = listOf(incoming, meta.field);
    const prevSet = new Set(prevItems.map((v) => v.toLowerCase()));
    const nextSet = new Set(nextItems.map((v) => v.toLowerCase()));

    nextItems.forEach((value, index) => {
      const key = value.toLowerCase();
      if (prevSet.has(key)) return;
      const conflictWith = prevItems.find(
        (p) => lookAlike(p, value) && p.toLowerCase() !== key,
      );
      items.push({
        id: `list:${meta.field}:${index}:${key}`,
        category: conflictWith ? "conflict" : "new",
        section: meta.section,
        field: meta.field as string,
        index,
        label: meta.label,
        previous: conflictWith,
        next: value,
        sources: incoming.fieldSources?.[meta.field as string],
        note: conflictWith
          ? `Similar to existing “${conflictWith}”.`
          : undefined,
      });
    });

    prevItems.forEach((value) => {
      const key = value.toLowerCase();
      if (nextSet.has(key)) return;
      // Only surface missing when import has some signal for this field
      if (nextItems.length === 0 && !firstImport) {
        items.push({
          id: `list-missing:${meta.field}:${key}`,
          category: "missing",
          section: meta.section,
          field: meta.field as string,
          label: meta.label,
          previous: value,
          note: "Present in your profile; not found in this import.",
        });
      }
    });
  }

  // Projects
  const prevProjects = base?.relevantProjects ?? [];
  const nextProjects = incoming.relevantProjects ?? [];
  const prevByTitle = new Map(
    prevProjects.map((p) => [p.title.trim().toLowerCase(), p]),
  );
  const nextByTitle = new Map(
    nextProjects.map((p) => [p.title.trim().toLowerCase(), p]),
  );

  nextProjects.forEach((project, index) => {
    const key = project.title.trim().toLowerCase();
    const prev = prevByTitle.get(key);
    if (!prev) {
      items.push({
        id: `project:${index}:${key}`,
        category: "new",
        section: "Projects",
        field: "relevantProjects",
        index,
        projectTitle: project.title,
        label: project.title,
        next: project.summary || project.title,
        sources: project.sourcePointers,
      });
      return;
    }
    const prevSummary = norm(prev.summary);
    const nextSummary = norm(project.summary);
    if (prevSummary !== nextSummary && (prevSummary || nextSummary)) {
      items.push({
        id: `project:${index}:${key}`,
        category: lookAlike(prevSummary, nextSummary) ? "updated" : "conflict",
        section: "Projects",
        field: "relevantProjects",
        index,
        projectTitle: project.title,
        label: project.title,
        previous: prevSummary || undefined,
        next: nextSummary || undefined,
        sources: project.sourcePointers,
      });
    }
  });

  prevProjects.forEach((project) => {
    const key = project.title.trim().toLowerCase();
    if (nextByTitle.has(key)) return;
    if (nextProjects.length === 0) return;
    items.push({
      id: `project-missing:${key}`,
      category: "missing",
      section: "Projects",
      field: "relevantProjects",
      projectTitle: project.title,
      label: project.title,
      previous: project.summary || project.title,
      note: "In your profile; not found in this import.",
    });
  });

  // Grounding / uncertain
  for (const note of incoming.groundingNotes ?? []) {
    if (!note.trim()) continue;
    items.push({
      id: `uncertain:${note.slice(0, 48)}`,
      category: "uncertain",
      section: "Needs review",
      field: "groundingNotes",
      label: "Could not classify confidently",
      next: note,
      note: "Review manually — not applied as a hard fact.",
    });
  }

  const counts: Record<DiffCategory, number> = {
    new: 0,
    updated: 0,
    conflict: 0,
    unchanged: 0,
    uncertain: 0,
    missing: 0,
  };
  for (const item of items) counts[item.category] += 1;

  return { items, counts };
}

export type DiffDecision = "accept" | "reject" | "keep_previous";

/**
 * Apply per-item decisions to merge incoming into baseline.
 * - accept: take incoming value
 * - reject / keep_previous: keep baseline (or omit new)
 */
export function applyProfileDiffDecisions(
  baseline: StructuredProfile | null | undefined,
  incoming: StructuredProfile,
  decisions: Record<string, DiffDecision>,
): StructuredProfile {
  const base: StructuredProfile = baseline
    ? structuredClone(baseline)
    : {
        strongestSkills: [],
        industries: [],
        productTypes: [],
        relevantProjects: [],
        tools: [],
        licenses: [],
        workAuthorization: [],
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

  const result = structuredClone(base);
  const diff = diffStructuredProfiles(base, incoming);

  const decisionFor = (id: string, category: DiffCategory): DiffDecision => {
    if (decisions[id]) return decisions[id]!;
    // Defaults: accept new/updated; keep previous on conflict/missing; skip uncertain
    if (category === "new" || category === "updated") return "accept";
    if (category === "conflict" || category === "missing") return "keep_previous";
    return "reject";
  };

  for (const item of diff.items) {
    const decision = decisionFor(item.id, item.category);
    if (item.field === "groundingNotes") continue;

    if (item.field === "compensation") {
      if (decision === "accept") {
        result.compensation = incoming.compensation;
        result.salaryOrRateExpectations = incoming.salaryOrRateExpectations;
      }
      continue;
    }

    if (item.field === "relevantProjects") {
      if (item.category === "new" && decision === "accept" && item.index != null) {
        const project = incoming.relevantProjects[item.index];
        if (project) {
          const exists = result.relevantProjects.some(
            (p) =>
              p.title.trim().toLowerCase() === project.title.trim().toLowerCase(),
          );
          if (!exists) result.relevantProjects.push(project);
        }
      } else if (
        (item.category === "updated" || item.category === "conflict") &&
        decision === "accept" &&
        item.projectTitle
      ) {
        const incomingProject = incoming.relevantProjects.find(
          (p) =>
            p.title.trim().toLowerCase() ===
            item.projectTitle!.trim().toLowerCase(),
        );
        if (incomingProject) {
          const idx = result.relevantProjects.findIndex(
            (p) =>
              p.title.trim().toLowerCase() ===
              item.projectTitle!.trim().toLowerCase(),
          );
          if (idx >= 0) result.relevantProjects[idx] = incomingProject;
          else result.relevantProjects.push(incomingProject);
        }
      } else if (item.category === "missing" && decision === "reject") {
        result.relevantProjects = result.relevantProjects.filter(
          (p) =>
            p.title.trim().toLowerCase() !==
            (item.projectTitle ?? "").trim().toLowerCase(),
        );
      }
      continue;
    }

    const isList = LIST_FIELDS.some((f) => f.field === item.field);
    if (isList) {
      const key = item.field as keyof StructuredProfile;
      const current = listOf(result, key);
      if (item.category === "new" && decision === "accept" && item.next) {
        if (!current.some((v) => v.toLowerCase() === item.next!.toLowerCase())) {
          (result as Record<string, unknown>)[item.field] = [
            ...current,
            item.next,
          ];
        }
      } else if (
        item.category === "conflict" &&
        decision === "accept" &&
        item.next
      ) {
        const without = current.filter(
          (v) =>
            v.toLowerCase() !== (item.previous ?? "").toLowerCase() &&
            v.toLowerCase() !== item.next!.toLowerCase(),
        );
        (result as Record<string, unknown>)[item.field] = [
          ...without,
          item.next,
        ];
      } else if (item.category === "missing" && decision === "reject" && item.previous) {
        (result as Record<string, unknown>)[item.field] = current.filter(
          (v) => v.toLowerCase() !== item.previous!.toLowerCase(),
        );
      }
      continue;
    }

    // Scalar
    if (decision === "accept") {
      (result as Record<string, unknown>)[item.field] =
        item.field === "yearsExperience"
          ? item.next
            ? Number(item.next)
            : null
          : item.next || undefined;
      if (incoming.fieldSources?.[item.field]) {
        result.fieldSources = {
          ...result.fieldSources,
          [item.field]: incoming.fieldSources[item.field]!,
        };
      }
    }
  }

  // Merge field sources for accepted list fields from incoming
  result.fieldSources = {
    ...result.fieldSources,
    ...Object.fromEntries(
      Object.entries(incoming.fieldSources ?? {}).filter(([k]) => {
        const hasAccept = diff.items.some(
          (i) =>
            i.field === k &&
            decisionFor(i.id, i.category) === "accept" &&
            i.category !== "missing",
        );
        return hasAccept;
      }),
    ),
  };

  return result;
}

/** Remove a list item or clear a scalar fact from a profile. */
export function removeProfileFact(
  profile: StructuredProfile,
  input: {
    field: string;
    index?: number;
    value?: string;
    projectTitle?: string;
  },
): StructuredProfile {
  const next = structuredClone(profile);
  if (input.field === "relevantProjects" && input.projectTitle) {
    next.relevantProjects = next.relevantProjects.filter(
      (p) =>
        p.title.trim().toLowerCase() !==
        input.projectTitle!.trim().toLowerCase(),
    );
    return next;
  }
  if (input.field === "compensation") {
    next.compensation = undefined;
    next.salaryOrRateExpectations = undefined;
    return next;
  }
  const listFields = new Set(LIST_FIELDS.map((f) => f.field as string));
  if (listFields.has(input.field)) {
    const current = listOf(next, input.field as keyof StructuredProfile);
    const filtered =
      input.index != null
        ? current.filter((_, i) => i !== input.index)
        : current.filter(
            (v) =>
              v.toLowerCase() !== (input.value ?? "").trim().toLowerCase(),
          );
    (next as Record<string, unknown>)[input.field] = filtered;
    return next;
  }
  (next as Record<string, unknown>)[input.field] =
    input.field === "yearsExperience" ? null : undefined;
  if (next.fieldSources?.[input.field]) {
    const rest = { ...next.fieldSources };
    delete rest[input.field];
    next.fieldSources = rest;
  }
  return next;
}

/** Update a scalar or replace a list item value. */
export function updateProfileFact(
  profile: StructuredProfile,
  input: {
    field: string;
    value: string;
    index?: number;
    projectTitle?: string;
  },
): StructuredProfile {
  const next = structuredClone(profile);
  if (input.field === "relevantProjects" && input.projectTitle) {
    const idx = next.relevantProjects.findIndex(
      (p) =>
        p.title.trim().toLowerCase() ===
        input.projectTitle!.trim().toLowerCase(),
    );
    if (idx >= 0) {
      next.relevantProjects[idx] = {
        ...next.relevantProjects[idx]!,
        summary: input.value,
      };
    }
    return next;
  }
  const listFields = new Set(LIST_FIELDS.map((f) => f.field as string));
  if (listFields.has(input.field)) {
    const current = listOf(next, input.field as keyof StructuredProfile);
    if (input.index != null && input.index >= 0 && input.index < current.length) {
      current[input.index] = input.value.trim();
      (next as Record<string, unknown>)[input.field] = current.filter(Boolean);
    } else if (input.value.trim()) {
      (next as Record<string, unknown>)[input.field] = [
        ...current,
        input.value.trim(),
      ];
    }
    return next;
  }
  if (input.field === "yearsExperience") {
    const n = Number(input.value);
    next.yearsExperience = input.value.trim() && !Number.isNaN(n) ? n : null;
    return next;
  }
  (next as Record<string, unknown>)[input.field] =
    input.value.trim() || undefined;
  return next;
}
