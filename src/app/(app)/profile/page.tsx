import { MarketFitPanel } from "@/components/market-fit-panel";
import { MatchingSourcesPanel } from "@/components/matching-sources-panel";
import { ProfileImportReview } from "@/components/profile-import-review";
import {
  ProfileWorkspace,
  type ProfileFixTarget,
} from "@/components/profile-workspace";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ensureDb } from "@/db/ensure";
import { diffStructuredProfiles } from "@/modules/profile/diff";
import { getMarketFitReport } from "@/modules/profile/market-fit";
import { getMatchingSourcesConfig } from "@/modules/profile/matching-sources";
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
        description="See what’s holding you back for more companies, then tighten sources and the approved profile used for matching."
        meta={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Fit {marketFit.score}</Badge>
            {marketFit.openHighImpactCount > 0 ? (
              <Badge variant="outline">
                {marketFit.openHighImpactCount} to fix
              </Badge>
            ) : null}
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

      <MarketFitPanel report={marketFit} />

      {showImportReview && draft ? (
        <ProfileImportReview draftId={draft.id} items={importDiff!.items} />
      ) : null}

      <ProfileWorkspace
        sources={sources}
        usePortfolioInMatching={matchingConfig.portfolioProjects}
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
