import { ProfileWorkspace } from "@/components/profile-workspace";
import { PageShell, SectionTitle } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { ensureDb } from "@/db/ensure";
import {
  getApprovedProfile,
  getLatestDraftProfile,
  listProfileSources,
} from "@/modules/profile/queries";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  ensureDb();
  const sources = listProfileSources().map((s) => ({
    id: s.id,
    type: s.type,
    label: s.label,
    sourceUrl: s.sourceUrl,
    ingestedAt: s.ingestedAt,
    textLength: s.rawText?.length ?? 0,
  }));
  const draft = getLatestDraftProfile();
  const approved = getApprovedProfile();

  return (
    <PageShell width="lead" className="gap-6 lg:gap-8">
      <SectionTitle
        title="Profile"
        description="Sources → draft → approve. Matching uses the approved version."
        meta={
          <div className="flex flex-wrap gap-2 pt-1">
            {approved ? (
              <Badge>Approved v{approved.version}</Badge>
            ) : (
              <Badge variant="outline">Not approved yet</Badge>
            )}
            {draft ? (
              <Badge variant="secondary">Draft v{draft.version}</Badge>
            ) : null}
          </div>
        }
      />
      <ProfileWorkspace
        sources={sources}
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
      />
    </PageShell>
  );
}
