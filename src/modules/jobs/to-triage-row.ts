import type { JobTriageRow } from "@/modules/jobs/triage-row";
import type { DailyJobRow } from "@/modules/jobs/queries";

/** Map server job row → client triage card props. */
export function toJobTriageRow(row: DailyJobRow): JobTriageRow {
  return {
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
    companySnapshot: row.companySnapshot,
  };
}

export type { JobTriageRow };
