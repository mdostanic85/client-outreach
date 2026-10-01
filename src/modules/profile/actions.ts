"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logging/logger";
import { runAction } from "@/lib/server-action";
import { generateSearchProfile } from "@/modules/search-profile/generate";
import { approveStructuredProfile } from "./approve";
import type { DiffDecision } from "./diff";
import { createDraftFromApprovedProfile, saveDraftProfileEdits } from "./extract";
import { addFact, applyDiffDecisionsToDraft, removeFact, updateFact } from "./facts";
import { rebuildDraftProfile } from "./rebuild";
import {
  ingestFileUpload,
  ingestGithubProfile,
  ingestPortfolioUrl,
  ingestTextSource,
  isFileProfileSourceType,
  refreshProfileSource,
  setProfileSourceMatchingEnabled,
  softDeleteProfileSource,
} from "./ingest";
import { setMatchingSourcesConfig, type MatchingSourcesConfig } from "./matching-sources";
import type { StructuredProfile } from "./schemas";

/**
 * Profile actions: each account manages its own sources and versioned
 * profile. Matching only ever reads the approved version.
 */

/** Profile edits show on both Profile and the onboarding review. */
function revalidateProfileViews() {
  revalidatePath("/profile");
  revalidatePath("/onboarding");
}

/** Changes to what matching reads also reshuffle Today. */
function revalidateMatchingInputs() {
  revalidatePath("/profile");
  revalidatePath("/");
}

// ─── Sources ────────────────────────────────────────────────────────────────

export async function ingestCvAction(formData: FormData) {
  return runAction("profile.ingestFile", "user", async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No file uploaded");
    const rawType = String(formData.get("type") ?? "cv");
    if (!isFileProfileSourceType(rawType)) throw new Error("Invalid source type");

    const isLinkedIn = rawType === "linkedin_text";
    const result = await ingestFileUpload({
      filename: file.name || (isLinkedIn ? "linkedin-profile.pdf" : "cv.pdf"),
      bytes: Buffer.from(await file.arrayBuffer()),
      type: rawType,
      label: isLinkedIn ? file.name || "LinkedIn Save to PDF" : undefined,
    });
    revalidatePath("/profile");
    return result;
  });
}

export async function ingestTextSourceAction(input: {
  type: "cv" | "linkedin_text" | "document" | "manual";
  text: string;
  label?: string;
}) {
  return runAction("profile.ingestText", "user", async () => {
    const result = await ingestTextSource(input);
    revalidatePath("/profile");
    return result;
  });
}

export async function ingestPortfolioUrlAction(url: string) {
  return runAction("profile.ingestPortfolio", "user", async () => {
    const result = await ingestPortfolioUrl(url);
    revalidatePath("/profile");
    return result;
  });
}

export async function ingestGithubAction(usernameOrUrl: string) {
  return runAction("profile.ingestGithub", "user", async () => {
    const result = await ingestGithubProfile(usernameOrUrl);
    revalidateProfileViews();
    return result;
  });
}

export async function ingestManualNotesAction(text: string) {
  return runAction("profile.ingestManualNotes", "user", async () => {
    const result = await ingestTextSource({
      type: "manual",
      text,
      label: "Manual preferences",
    });
    revalidatePath("/profile");
    return result;
  });
}

export async function deleteProfileSourceAction(
  id: string,
  options?: { confirmed?: boolean },
) {
  return runAction("profile.deleteSource", "user", async () => {
    if (!options?.confirmed) {
      throw new Error("Confirm delete to remove this source connection.");
    }
    await softDeleteProfileSource(id);
    revalidateProfileViews();
  });
}

export async function refreshProfileSourceAction(id: string) {
  return runAction("profile.refreshSource", "user", async () => {
    const result = await refreshProfileSource(id);
    revalidatePath("/profile");
    return result;
  });
}

// ─── What matching reads ────────────────────────────────────────────────────

export async function setProfileSourceMatchingEnabledAction(id: string, enabled: boolean) {
  return runAction("profile.setSourceMatching", "user", async () => {
    await setProfileSourceMatchingEnabled(id, enabled);
    revalidateMatchingInputs();
  });
}

export async function setMatchingSourcesConfigAction(patch: Partial<MatchingSourcesConfig>) {
  return runAction("profile.setMatchingSources", "user", async () => {
    await setMatchingSourcesConfig(patch);
    revalidateMatchingInputs();
  });
}

/** Matching preference only — never deletes sources or profile knowledge. */
export async function setUsePortfolioInMatchingAction(enabled: boolean) {
  return runAction("profile.setUsePortfolio", "user", async () => {
    await setMatchingSourcesConfig({ portfolioProjects: enabled });
    revalidateMatchingInputs();
  });
}

// ─── Structured profile drafts ──────────────────────────────────────────────

/** Rebuilds the draft from every source, keeping the person's own preferences. */
export async function extractProfileAction() {
  return runAction("profile.extract", "user", async () => {
    const { profileId, version, model, usedPrivate, groundingIssues } = await rebuildDraftProfile();
    revalidatePath("/profile");
    return { profileId, version, model, usedPrivate, groundingIssues };
  });
}

export async function saveProfileDraftAction(profileId: string, profile: StructuredProfile) {
  return runAction("profile.saveDraft", "user", async () => {
    await saveDraftProfileEdits(profileId, profile);
    revalidateProfileViews();
  });
}

export async function updateProfileFactAction(input: {
  profileId: string;
  field: string;
  value: string;
  index?: number;
  projectTitle?: string;
}) {
  return runAction("profile.updateFact", "user", async () => {
    const result = await updateFact(input);
    revalidateProfileViews();
    return result;
  });
}

export async function removeProfileFactAction(input: {
  profileId: string;
  field: string;
  index?: number;
  value?: string;
  projectTitle?: string;
}) {
  return runAction("profile.removeFact", "user", async () => {
    const result = await removeFact(input);
    revalidateProfileViews();
    return result;
  });
}

export async function addProfileFactAction(input: {
  profileId: string;
  field: string;
  value: string;
}) {
  return runAction("profile.addFact", "user", async () => {
    const result = await addFact(input);
    revalidateProfileViews();
    return result;
  });
}

export async function applyProfileDiffDecisionsAction(input: {
  draftId: string;
  decisions: Record<string, DiffDecision>;
  edits?: Record<string, string>;
}) {
  return runAction("profile.applyDiff", "user", async () => {
    const result = await applyDiffDecisionsToDraft(input);
    revalidateProfileViews();
    return result;
  });
}

export async function createProfileDraftFromApprovedAction() {
  return runAction("profile.createDraftFromApproved", "user", async () => {
    const result = await createDraftFromApprovedProfile();
    revalidateProfileViews();
    return result;
  });
}

/**
 * Approves the profile, then drafts new search criteria from it. The draft is
 * a convenience: if it fails, the approval still stands and the user can
 * generate criteria on the Search page.
 */
export async function approveProfileAction(profileId: string) {
  return runAction("profile.approve", "user", async () => {
    const result = await approveStructuredProfile(profileId);

    let searchProfileDraftId: string | undefined;
    try {
      const draft = await generateSearchProfile({ trigger: "profile_approved" });
      searchProfileDraftId = draft.id;
    } catch (err) {
      logger.warn({ err, profileId }, "search profile auto-generate failed");
    }

    revalidatePath("/profile");
    revalidatePath("/search-criteria");
    revalidatePath("/settings/voice");
    return { ...result, searchProfileDraftId };
  });
}
