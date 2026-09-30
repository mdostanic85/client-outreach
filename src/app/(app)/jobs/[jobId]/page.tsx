import { notFound } from "next/navigation";
import { JobDetail } from "@/components/job-detail";
import { ensureDb } from "@/db/ensure";
import { listPackageMetaForJobs } from "@/modules/applications/packages";
import { getJobDescription, getJobDetail } from "@/modules/jobs/queries";
import { toJobTriageRow } from "@/modules/jobs/to-triage-row";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await ensureDb();
  const { jobId } = await params;
  const [detail, description, packageMeta] = await Promise.all([
    getJobDetail(jobId),
    getJobDescription(jobId),
    listPackageMetaForJobs([jobId]),
  ]);
  if (!detail) notFound();

  return (
    <JobDetail
      row={toJobTriageRow(detail)}
      description={description ?? ""}
      packageMeta={packageMeta[jobId] ?? null}
    />
  );
}
