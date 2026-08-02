import { MatchingSourcesPanel } from "@/components/matching-sources-panel";
import { ProfileImportReview } from "@/components/profile-import-review";
import { ProfileWorkspace } from "@/components/profile-workspace";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ensureDb } from "@/db/ensure";
import { diffStructuredProfiles } from "@/modules/profile/diff";
import { getMatchingSourcesConfig } from "@/modules/profile/matching-sources";
import {
  getApprovedProfile,
  getLatestDraftProfile,
  listProfileSources,
} from "@/modules/profile/queries";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  ensureDb();
  const matchingConfig = getMatchingSourcesConfig();
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
        description="Add sources, review what Optra knows, then approve the version used for job matching."
        meta={
          <div className="flex flex-wrap gap-2">
            {approved ? (
              <Tooltip>
                <TooltipTrigger
                  render={<Badge className="cursor-help" />}
                >
                  Approved v{approved.version}
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left leading-relaxed">
                  Matching and job search use this version until you approve a
                  newer draft.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge variant="outline">Not approved yet</Badge>
            )}
            {draft ? (
              <Badge variant="secondary">Draft v{draft.version}</Badge>
            ) : null}
            {!matchingConfig.portfolioProjects ? (
              <Badge variant="outline">Portfolio projects off for matching</Badge>
            ) : null}
          </div>
        }
      />

      {showImportReview && draft ? (
        <ProfileImportReview draftId={draft.id} items={importDiff!.items} />
      ) : null}

      <ProfileWorkspace
        sources={sources}
        usePortfolioInMatching={matchingConfig.portfolioProjects}
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
        <MatchingSourcesPanel
          config={matchingConfig}
          sources={sources.map((s) => ({
            id: s.id,
            type: s.type,
            label: s.label,
            enabledForMatching: s.enabledForMatching,
            lastSyncedAt: s.lastSyncedAt,
          }))}
        />
      </ProfileWorkspace>
    </PageShell>
  );
}
