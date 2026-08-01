import { ProfileWorkspace } from "@/components/profile-workspace";
import { PageHeader, PageShell } from "@/components/page-shell";
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
    <PageShell width="lead">
      <PageHeader
        title="Profile"
        description="Add your CV, LinkedIn, portfolio, or notes. Review the draft, then approve it for matching."
        meta={
          approved
            ? `Matching uses approved version ${approved.version}`
            : "No approved profile yet"
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
