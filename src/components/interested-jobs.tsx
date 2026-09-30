"use client";

import { useMemo } from "react";
import { Bookmark } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { JobListItem } from "@/components/job-list-item";
import type { PackageListMeta } from "@/modules/applications/packages";
import type { JobTriageRow } from "@/modules/jobs/triage-row";
import { timezoneOverlapVaries } from "@/modules/matching/remote-fit";
import { Stagger, StaggerItem } from "@/components/motion";
import {
  PageHeader,
  PageShell,
  Surface,
} from "@/components/page-shell";

/**
 * Saved jobs. Each row opens the job page, where the application is
 * prepared and the job can be marked applied or dropped.
 */
export function InterestedJobs({
  rows,
  packageMeta = {},
}: {
  rows: JobTriageRow[];
  packageMeta?: Record<string, PackageListMeta>;
}) {
  const showTimezoneChip = useMemo(
    () =>
      timezoneOverlapVaries(rows.map((row) => row.remoteFit.timezoneOverlap)),
    [rows],
  );

  return (
    <PageShell>
      <PageHeader
        title="Saved"
        description="Roles you liked. Open one to prepare the application or mark it applied."
        meta={`${rows.length} role${rows.length === 1 ? "" : "s"}`}
      />

      {rows.length === 0 ? (
        <Surface>
          <EmptyState
            title="Nothing saved yet"
            description="On Today, open a role and click Save job. It shows up here."
            icon={<Bookmark className="size-5" strokeWidth={1.5} />}
            actionLabel="Back to Today"
            actionHref="/"
          />
        </Surface>
      ) : (
        <Stagger as="ul" className="bg-card divide-y divide-border overflow-hidden rounded-card shadow-card">
          {rows.map((row) => (
            <StaggerItem key={row.jobId} as="li">
              <JobListItem
                variant="interested"
                row={row}
                packageMeta={packageMeta[row.jobId] ?? null}
                showTimezoneChip={showTimezoneChip}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </PageShell>
  );
}
