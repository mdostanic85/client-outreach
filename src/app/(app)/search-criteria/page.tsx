import { SearchCriteriaWorkspace } from "@/components/search-criteria-workspace";
import { ensureDb } from "@/db/ensure";
import {
  getApprovedSearchProfile,
  getLatestDraftSearchProfile,
} from "@/modules/search-profile/queries";

export const dynamic = "force-dynamic";

export default async function SearchCriteriaPage() {
  await ensureDb();
  const draft = await getLatestDraftSearchProfile();
  const approved = await getApprovedSearchProfile();

  return (
    <SearchCriteriaWorkspace
      draft={
        draft
          ? {
              id: draft.id,
              version: draft.version,
              params: draft.params,
              rationale: draft.rationale,
            }
          : null
      }
      approved={
        approved
          ? {
              id: approved.id,
              version: approved.version,
              params: approved.params,
              approvedAt: approved.approvedAt,
            }
          : null
      }
    />
  );
}
