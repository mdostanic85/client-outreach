import type { PackageListMeta } from "@/modules/applications/packages";
import { isApplicationSent } from "@/modules/applications/schemas";
import type { JobTriageRow } from "@/modules/jobs/triage-row";

/** Short facts shown next to a job: place, work mode, type, pay. */
export function jobFacts(row: JobTriageRow): string[] {
  return [
    row.location,
    row.remotePolicy,
    row.employmentType,
    row.companySnapshot.salaryText,
  ].filter((fact): fact is string => Boolean(fact?.trim()));
}

/** Package progress label on a saved job, or null when nothing started. */
export function packageBadgeLabel(meta: PackageListMeta | null | undefined): string | null {
  if (isApplicationSent(meta?.mailStatus)) return "Sent";
  if (meta?.state === "prepared") return "Prepared";
  if (meta?.state === "approved") return "Approved";
  if (meta?.state === "draft") return "Draft pack";
  return null;
}

/** Next application step for a saved job: prepare, send or follow in Queue. */
export function packageCta(
  jobId: string,
  meta: PackageListMeta | null | undefined,
): { href: string; label: string } {
  if (isApplicationSent(meta?.mailStatus)) {
    return { href: "/queue?tab=applications", label: "View in Queue" };
  }
  if (meta?.state === "prepared" || meta?.state === "approved") {
    return { href: `/interested/${jobId}/package?send=1`, label: "Send application" };
  }
  return { href: `/interested/${jobId}/package`, label: "Prepare application" };
}

/** "27 Sept 2026"; fixed locale and UTC so server and client agree. */
export function formatPostedDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
