import { InterestedJobs } from "@/components/interested-jobs";
import { ensureDb } from "@/db/ensure";
import { listInterestedJobs } from "@/modules/jobs/queries";

export const dynamic = "force-dynamic";

export default function InterestedPage() {
  ensureDb();
  const rows = listInterestedJobs();

  return (
    <InterestedJobs
      rows={rows.map((row) => ({
        jobId: row.job.id,
        title: row.job.title,
        companyName: row.company?.name ?? "Unknown",
        location: row.job.location,
        remotePolicy: row.job.remotePolicy,
        employmentType: row.job.employmentType,
        source: row.job.source,
        sourceUrl: row.job.sourceUrl,
        matchScore: row.match?.matchScore ?? null,
        eligibility: row.match?.eligibility ?? null,
        recommendation: row.match?.recommendation ?? null,
        matchingReasons: row.matchingReasons,
        concerns: row.concerns,
        remoteFit: row.remoteFit,
        mainRisk: row.mainRisk,
        missingRequirements: row.missingRequirements,
        remoteRequired: row.remoteRequired,
        postedAt: row.job.postedAt,
        triageState: row.job.triageState,
      }))}
    />
  );
}
