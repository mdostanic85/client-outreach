"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureDb } from "@/db/ensure";
import { getSessionUser } from "@/modules/auth/session";
import {
  getOnboardingStatus,
  markOnboardingComplete,
} from "@/modules/onboarding/state";
import {
  applySurveyToProfile,
  summarizeProfile,
  type ProfileSummary,
  applySurveyToSearchParams,
  getSurvey,
  saveSurveyPatch,
  type SurveyAnswers,
} from "@/modules/onboarding/survey";
import { approveStructuredProfile } from "@/modules/profile/approve";
import { runCvReview, type CvReviewView } from "@/modules/profile/cv-review";
import {
  extractStructuredProfile,
  saveDraftProfileEdits,
} from "@/modules/profile/extract";
import {
  getApprovedProfile,
  getLatestDraftProfile,
  getStructuredProfileById,
} from "@/modules/profile/queries";
import { approveSearchProfile } from "@/modules/search-profile/approve";
import {
  generateSearchProfile,
  saveSearchProfileDraft,
} from "@/modules/search-profile/generate";
import { getSearchProfileById } from "@/modules/search-profile/queries";
import {
  classifyOccupation,
  type ClassifiedOccupation,
} from "@/modules/occupations/classify";

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const status = await getOnboardingStatus(user.id);
  if (!status.hasApprovedProfile) {
    return { ok: false, error: "Approve your profile before finishing setup." };
  }
  if (!status.hasApprovedSearch) {
    return {
      ok: false,
      error: "Approve search criteria before finishing setup.",
    };
  }

  await markOnboardingComplete(user.id);
  revalidatePath("/");
  revalidatePath("/onboarding");
  redirect("/?first=1");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

/** Saves one survey screen. Called on every Continue so a refresh never loses answers. */
export async function saveSurveyStepAction(
  patch: SurveyAnswers,
): Promise<OnboardingActionResult> {
  try {
    await ensureDb();
    await saveSurveyPatch(patch);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Places a job title we don't have in the catalog. Only the title is sent to
 * the model; the user confirms the family on the next screen.
 */
export async function classifyRoleAction(
  title: string,
): Promise<{ ok: true; data: ClassifiedOccupation } | { ok: false; error: string }> {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed) return { ok: false, error: "Type the job you're looking for." };
  try {
    await ensureDb();
    if (!(await getSessionUser())) return { ok: false, error: "Not signed in." };
    return { ok: true, data: await classifyOccupation(trimmed) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Reads every source into a draft profile (survey answers override what the
 * model inferred) and reviews the CV. Both AI calls run in parallel.
 */
export async function analyzeProfileAction(): Promise<
  | { ok: true; summary: ProfileSummary; review: CvReviewView | null }
  | { ok: false; error: string }
> {
  try {
    await ensureDb();
    const survey = await getSurvey();
    const [extracted, review] = await Promise.all([
      extractStructuredProfile(),
      runCvReview(survey).catch(() => null),
    ]);
    const draft = await getStructuredProfileById(extracted.profileId);
    if (!draft) throw new Error("Profile draft missing.");
    const merged = applySurveyToProfile(draft.profile, survey);
    await saveDraftProfileEdits(extracted.profileId, merged);
    return { ok: true, summary: summarizeProfile(merged), review };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** "Looks right": approves the profile and search criteria in one step. */
export async function confirmProfileAction(): Promise<OnboardingActionResult> {
  try {
    await ensureDb();
    const draft = await getLatestDraftProfile();
    if (draft) await approveStructuredProfile(draft.id);
    if (!(await getApprovedProfile())) {
      return { ok: false, error: "Upload your CV first." };
    }

    const survey = await getSurvey();
    const search = await generateSearchProfile({ trigger: "manual" });
    const generated = await getSearchProfileById(search.id);
    if (generated) {
      await saveSearchProfileDraft(
        search.id,
        applySurveyToSearchParams(generated.params, survey),
      );
    }
    await approveSearchProfile(search.id);
    revalidatePath("/onboarding");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Re-run the CV review (e.g. after uploading a new version on Profile). */
export async function reviewCvAction(): Promise<
  { ok: true; review: CvReviewView } | { ok: false; error: string }
> {
  try {
    await ensureDb();
    return { ok: true, review: await runCvReview(await getSurvey()) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
