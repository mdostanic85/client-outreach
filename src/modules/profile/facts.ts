import {
  applyProfileDiffDecisions,
  removeProfileFact,
  updateProfileFact,
  type DiffDecision,
} from "./diff";
import {
  createDraftFromApprovedProfile,
  saveDraftProfileEdits,
} from "./extract";
import {
  getApprovedProfile,
  getLatestDraftProfile,
  getStructuredProfileById,
} from "./queries";
import {
  StructuredProfileSchema,
  type StructuredProfile,
} from "./schemas";

/** Ensure a draft exists for editing; fork from approved when needed. */
export function ensureEditableDraft(profileId?: string | null): {
  profileId: string;
  profile: StructuredProfile;
} {
  if (profileId) {
    const row = getStructuredProfileById(profileId);
    if (row?.status === "draft") {
      return { profileId: row.id, profile: row.profile };
    }
  }

  const draft = getLatestDraftProfile();
  if (draft) {
    return { profileId: draft.id, profile: draft.profile };
  }

  const forked = createDraftFromApprovedProfile();
  const row = getStructuredProfileById(forked.profileId);
  if (!row) throw new Error("Could not create editable draft");
  return { profileId: row.id, profile: row.profile };
}

export function updateFact(input: {
  profileId: string;
  field: string;
  value: string;
  index?: number;
  projectTitle?: string;
}): { profileId: string } {
  const { profileId, profile } = ensureEditableDraft(input.profileId);
  const next = updateProfileFact(profile, input);
  saveDraftProfileEdits(profileId, StructuredProfileSchema.parse(next));
  return { profileId };
}

export function removeFact(input: {
  profileId: string;
  field: string;
  index?: number;
  value?: string;
  projectTitle?: string;
}): { profileId: string } {
  const { profileId, profile } = ensureEditableDraft(input.profileId);
  const next = removeProfileFact(profile, input);
  saveDraftProfileEdits(profileId, StructuredProfileSchema.parse(next));
  return { profileId };
}

export function addFact(input: {
  profileId: string;
  field: string;
  value: string;
}): { profileId: string } {
  return updateFact({
    profileId: input.profileId,
    field: input.field,
    value: input.value,
  });
}

/**
 * Merge import decisions into the draft.
 * Baseline = approved (or empty); incoming = current draft before decisions.
 * Result overwrites the draft.
 */
export function applyDiffDecisionsToDraft(input: {
  draftId: string;
  decisions: Record<string, DiffDecision>;
  edits?: Record<string, string>;
}): { profileId: string } {
  const draft = getStructuredProfileById(input.draftId);
  if (!draft || draft.status !== "draft") {
    throw new Error("Draft profile not found");
  }

  let incoming = draft.profile;
  // Apply inline edits to incoming values before merge
  if (input.edits) {
    for (const [id, value] of Object.entries(input.edits)) {
      if (!value.trim()) continue;
      if (id.startsWith("scalar:")) {
        const field = id.slice("scalar:".length);
        incoming = updateProfileFact(incoming, { field, value });
      } else if (id.startsWith("list:")) {
        // list:field:index:key
        const parts = id.split(":");
        const field = parts[1]!;
        const index = Number(parts[2]);
        if (!Number.isNaN(index)) {
          incoming = updateProfileFact(incoming, { field, index, value });
        }
      } else if (id.startsWith("project:")) {
        const projectTitle = draft.profile.relevantProjects.find((p) =>
          id.includes(p.title.trim().toLowerCase()),
        )?.title;
        if (projectTitle) {
          incoming = updateProfileFact(incoming, {
            field: "relevantProjects",
            projectTitle,
            value,
          });
        }
      }
    }
  }

  const approved = getApprovedProfile();
  const merged = applyProfileDiffDecisions(
    approved?.profile ?? null,
    incoming,
    input.decisions,
  );
  saveDraftProfileEdits(draft.id, StructuredProfileSchema.parse(merged));
  return { profileId: draft.id };
}
