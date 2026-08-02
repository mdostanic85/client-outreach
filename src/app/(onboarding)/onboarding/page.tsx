import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ensureDb } from "@/db/ensure";
import { getSessionUser } from "@/modules/auth/session";
import { getUsePortfolioInMatching } from "@/modules/jobs/queries";
import { getOnboardingStatus } from "@/modules/onboarding/state";
import {
  getApprovedProfile,
  getLatestDraftProfile,
  listProfileSources,
} from "@/modules/profile/queries";
import {
  getApprovedSearchProfile,
  getLatestDraftSearchProfile,
} from "@/modules/search-profile/queries";

export const dynamic = "force-dynamic";

function mapProfile(
  row: NonNullable<ReturnType<typeof getApprovedProfile>>,
) {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    modelId: row.modelId,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
    profile: row.profile,
    sourceIds: row.sourceIds,
  };
}

export default async function OnboardingPage() {
  ensureDb();
  const user = await getSessionUser();
  if (!user) return null;

  const status = getOnboardingStatus(user.id);
  const sources = listProfileSources().map((s) => ({
    id: s.id,
    type: s.type,
    label: s.label,
    sourceUrl: s.sourceUrl,
    ingestedAt: s.ingestedAt,
    textLength: s.rawText?.length ?? 0,
    lastSyncedAt: s.lastSyncedAt ?? s.ingestedAt,
    enabledForMatching: s.enabledForMatching !== 0,
  }));
  const draft = getLatestDraftProfile();
  const approved = getApprovedProfile();
  const draftSearch = getLatestDraftSearchProfile();
  const approvedSearch = getApprovedSearchProfile();
  const usePortfolioInMatching = getUsePortfolioInMatching();

  return (
    <OnboardingWizard
      initialStep={status.step === "welcome" && status.hasSources ? "profile" : status.step}
      hasSources={status.hasSources}
      hasApprovedProfile={status.hasApprovedProfile}
      hasApprovedSearch={status.hasApprovedSearch}
      userName={user.name}
      sources={sources}
      usePortfolioInMatching={usePortfolioInMatching}
      draftProfile={draft ? mapProfile(draft) : null}
      approvedProfile={approved ? mapProfile(approved) : null}
      draftSearch={
        draftSearch
          ? {
              id: draftSearch.id,
              version: draftSearch.version,
              params: draftSearch.params,
              rationale: draftSearch.rationale,
            }
          : null
      }
      approvedSearch={
        approvedSearch
          ? {
              id: approvedSearch.id,
              version: approvedSearch.version,
              params: approvedSearch.params,
              approvedAt: approvedSearch.approvedAt,
            }
          : null
      }
    />
  );
}
