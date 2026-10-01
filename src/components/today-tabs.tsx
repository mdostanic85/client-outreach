"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { setTodayModeAction } from "@/modules/settings/actions";
import { JobsInbox } from "@/components/jobs-inbox";
import type { JobTriageRow } from "@/modules/jobs/triage-row";
import { AnimateIn } from "@/components/motion";
import { PageShell } from "@/components/page-shell";
import { ModeSwitch } from "@/components/segmented-control";
import { TriageInbox, type TriageRow } from "@/components/triage-inbox";

export function TodayTabs({
  mode,
  jobRows,
  leadRows,
  hasSearchProfile,
  clientsEnabled,
  autoSearch,
}: {
  mode: "jobs" | "clients";
  /** Company outreach is owner-only; others only see jobs. */
  clientsEnabled: boolean;
  jobRows: JobTriageRow[];
  leadRows: TriageRow[];
  hasSearchProfile: boolean;
  autoSearch: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [jobsSearching, setJobsSearching] = useState(false);
  const [companiesSearching, setCompaniesSearching] = useState(false);
  const onJobsSearchingChange = useCallback((next: boolean) => {
    setJobsSearching(next);
  }, []);
  const onCompaniesSearchingChange = useCallback((next: boolean) => {
    setCompaniesSearching(next);
  }, []);

  const searching = jobsSearching || companiesSearching;

  const switchMode = (next: "jobs" | "clients") => {
    if (searching) return;
    startTransition(async () => {
      await setTodayModeAction(next);
      router.refresh();
    });
  };

  return (
    <PageShell>
      <div className="space-y-6">
        {clientsEnabled ? (
        <ModeSwitch
          ariaLabel="Today view"
          value={mode}
          disabled={pending || searching}
          disabledHint="Stay on this page until the search finishes."
          onChange={switchMode}
          options={[
            {
              id: "jobs",
              label: "Jobs",
              count: jobRows.length,
              description: "Roles that match your profile",
            },
            {
              id: "clients",
              label: "Companies",
              count: leadRows.length,
              description: "Companies to research and email",
            },
          ]}
        />
        ) : null}

        <AnimateIn key={mode} variant="fade">
          {mode === "jobs" ? (
            <JobsInbox
              rows={jobRows}
              hasSearchProfile={hasSearchProfile}
              autoSearch={autoSearch}
              onSearchingChange={onJobsSearchingChange}
            />
          ) : (
            <TriageInbox
              rows={leadRows}
              embedded
              onSearchingChange={onCompaniesSearchingChange}
            />
          )}
        </AnimateIn>
      </div>
    </PageShell>
  );
}
