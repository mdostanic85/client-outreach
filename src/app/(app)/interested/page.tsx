import { InterestedJobs } from "@/components/interested-jobs";
import { ensureDb } from "@/db/ensure";
import { listPackageMetaForJobs } from "@/modules/applications/packages";
import { listInterestedJobs } from "@/modules/jobs/queries";
import { toJobTriageRow } from "@/modules/jobs/to-triage-row";

export const dynamic = "force-dynamic";

export default async function InterestedPage() {
  await ensureDb();
  const rows = await listInterestedJobs();
  const packageMeta = await listPackageMetaForJobs(
    rows.map((r) => r.job.id),
  );

  return (
    <InterestedJobs
      rows={rows.map(toJobTriageRow)}
      packageMeta={packageMeta}
    />
  );
}
