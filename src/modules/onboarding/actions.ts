"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import { currentUserId } from "@/modules/auth/current-user";
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

/**
 * Onboarding runs for a signed-in account before its first search. Every
 * action returns the shared `ActionResult`; finishing setup redirects to Today.
 */

export async function completeOnboardingAction() {
  const result = await runAction("onboarding.complete", "user", async () => {
    const userId = await currentUserId();
    const status = await getOnboardingStatus(userId);
    if (!status.hasApprovedProfile) {
      throw new Error("Approve your profile before finishing setup.");
    }
    if (!status.hasApprovedSearch) {
      throw new Error("Approve search criteria before finishing setup.");
    }
    await markOnboardingComplete(userId);
    revalidatePath("/");
    revalidatePath("/onboarding");
  });
  if (result.ok) redirect("/?first=1");
  return result;
}

/** Saves one survey screen. Called on every Continue so a refresh never loses answers. */
export async function saveSurveyStepAction(patch: SurveyAnswers) {
  return runAction("onboarding.saveSurveyStep", "user", async () => {
    await saveSurveyPatch(patch);
  });
}

/**
 * Places a job title we don't have in the catalog. Only the title is sent to
 * the model; the user confirms the family on the next screen.
 */
export async function classifyRoleAction(title: string) {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed) {
    return { ok: false as const, error: "Type the job you're looking for." };
  }
  return runAction("onboarding.classifyRole", "user", (): Promise<ClassifiedOccupation> =>
    classifyOccupation(trimmed),
  );
}

/**
 * Reads every source into a draft profile (survey answers override what the
 * model inferred) and reviews the CV. Both AI calls run in parallel.
 */
export async function analyzeProfileAction() {
  return runAction(
    "onboarding.analyzeProfile",
    "user",
    async (): Promise<{ summary: ProfileSummary; review: CvReviewView | null }> => {
      const survey = await getSurvey();
      const [extracted, review] = await Promise.all([
        extractStructuredProfile(),
        // The CV score is a bonus on this screen; the profile is what matters.
        runCvReview(survey).catch(() => null),
      ]);
      const draft = await getStructuredProfileById(extracted.profileId);
      if (!draft) throw new Error("Profile draft missing.");
      const merged = applySurveyToProfile(draft.profile, survey);
      await saveDraftProfileEdits(extracted.profileId, merged);
      return { summary: summarizeProfile(merged), review };
    },
  );
}

/** "Looks right": approves the profile and search criteria in one step. */
export async function confirmProfileAction() {
  return runAction("onboarding.confirmProfile", "user", async () => {
    const draft = await getLatestDraftProfile();
    if (draft) await approveStructuredProfile(draft.id);
    if (!(await getApprovedProfile())) throw new Error("Upload your CV first.");

    const survey = await getSurvey();
    const search = await generateSearchProfile({ trigger: "manual" });
    const generated = await getSearchProfileById(search.id);
    if (generated) {
      await saveSearchProfileDraft(search.id, applySurveyToSearchParams(generated.params, survey));
    }
    await approveSearchProfile(search.id);
    revalidatePath("/onboarding");
  });
}

/** Re-run the CV review (e.g. after uploading a new version on Profile). */
export async function reviewCvAction() {
  return runAction("onboarding.reviewCv", "user", async (): Promise<CvReviewView> =>
    runCvReview(await getSurvey()),
  );
}
