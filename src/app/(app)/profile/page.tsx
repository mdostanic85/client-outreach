import { WorthImproving } from "@/components/worth-improving";
import { MatchingSourcesPanel } from "@/components/matching-sources-panel";
import { ProfileImportReview } from "@/components/profile-import-review";
import {
  ProfileWorkspace,
  type ProfileFixTarget,
} from "@/components/profile-workspace";
import { PageHeader, PageShell } from "@/components/page-shell";
import { ProfileOverview } from "@/components/profile-overview";
import { ensureDb } from "@/db/ensure";
import { diffStructuredProfiles } from "@/modules/profile/diff";
import { getMarketFitReport } from "@/modules/profile/market-fit";
import { getMatchingSourcesConfig } from "@/modules/profile/matching-sources";
import { getLatestCvReview } from "@/modules/profile/cv-review";
import {
  getApprovedProfile,
  getLatestDraftProfile,
  listProfileSources,
} from "@/modules/profile/queries";

export const dynamic = "force-dynamic";

const FIX_TARGETS = new Set<ProfileFixTarget>([
  "sources",
  "essentials",
  "skills",
  "preferences",
  "evidence",
  "advanced",
]);

function parseFixParam(
  value: string | string[] | undefined,
): ProfileFixTarget | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !FIX_TARGETS.has(raw as ProfileFixTarget)) return null;
  return raw as ProfileFixTarget;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ fix?: string | string[] }>;
}) {
  await ensureDb();
  const params = await searchParams;
  const initialFix = parseFixParam(params.fix);
  const matchingConfig = await getMatchingSourcesConfig();
  const marketFit = await getMarketFitReport();
  const sources = (await listProfileSources()).map((s) => ({
    id: s.id,
    type: s.type,
    label: s.label,
    sourceUrl: s.sourceUrl,
    ingestedAt: s.ingestedAt,
    textLength: s.rawText?.length ?? 0,
    lastSyncedAt: s.lastSyncedAt ?? s.ingestedAt,
    enabledForMatching: s.enabledForMatching !== 0,
  }));
  const draft = await getLatestDraftProfile();
  const approved = await getApprovedProfile();
  const review = await getLatestCvReview();

  const importDiff =
    draft != null
      ? diffStructuredProfiles(approved?.profile ?? null, draft.profile)
      : null;
  const showImportReview =
    importDiff != null &&
    importDiff.items.some((i) =>
      ["new", "updated", "conflict", "missing", "uncertain"].includes(
        i.category,
      ),
    );

  return (
    <PageShell width="setup">
      <PageHeader
        title="Profile"
        description="What Optra knows about you. Matching uses the approved version."
      />

      <ProfileOverview review={review} hasCv={sources.some((s) => s.type === "cv")} />

      <WorthImproving report={marketFit} />

      {showImportReview && draft ? (
        <ProfileImportReview draftId={draft.id} items={importDiff!.items} />
      ) : null}

      <ProfileWorkspace
        sources={sources}
        matchingConfig={matchingConfig}
        initialFix={initialFix}
        draft={
          draft
            ? {
                id: draft.id,
                version: draft.version,
                status: draft.status,
                modelId: draft.modelId,
                promptVersion: draft.promptVersion,
                createdAt: draft.createdAt,
                approvedAt: draft.approvedAt,
                profile: draft.profile,
                sourceIds: draft.sourceIds,
              }
            : null
        }
        approved={
          approved
            ? {
                id: approved.id,
                version: approved.version,
                status: approved.status,
                modelId: approved.modelId,
                promptVersion: approved.promptVersion,
                createdAt: approved.createdAt,
                approvedAt: approved.approvedAt,
                profile: approved.profile,
                sourceIds: approved.sourceIds,
              }
            : null
        }
      >
        <MatchingSourcesPanel config={matchingConfig} />
      </ProfileWorkspace>
    </PageShell>
  );
}
