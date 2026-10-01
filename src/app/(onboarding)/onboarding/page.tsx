import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { FlowStep } from "@/modules/onboarding/flow";
import { ensureDb } from "@/db/ensure";
import { getSessionUser } from "@/modules/auth/session";
import {
  firstOpenQuestion,
  getSurvey,
  summarizeProfile,
} from "@/modules/onboarding/survey";
import { getLatestCvReview } from "@/modules/profile/cv-review";
import {
  getApprovedProfile,
  getLatestDraftProfile,
  listProfileSources,
} from "@/modules/profile/queries";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) return null;

  const [survey, sources, draft, approved, approvedSearch, review] =
    await Promise.all([
      getSurvey(),
      listProfileSources(),
      getLatestDraftProfile(),
      getApprovedProfile(),
      getApprovedSearchProfile(),
      getLatestCvReview(),
    ]);
  const hasCv = sources.some((s) => s.type === "cv");

  // Resume where the user left off.
  let initialStep: FlowStep;
  if (approved && approvedSearch) initialStep = "review";
  else if (draft) initialStep = "summary";
  else initialStep = firstOpenQuestion(survey) ?? "cv";

  return (
    <OnboardingFlow
      initialStep={initialStep}
      initialSurvey={survey}
      initialSummary={draft ? summarizeProfile(draft.profile) : null}
      initialReview={review}
      userName={user.name}
      hasCv={hasCv}
    />
  );
}
