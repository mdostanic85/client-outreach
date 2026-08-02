"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { setTodayModeAction } from "@/app/actions";
import { JobsInbox, type JobTriageRow } from "@/components/jobs-inbox";
import type { SetupChecklistItem } from "@/modules/onboarding/state";
import { SetupChecklistBanner } from "@/components/onboarding/setup-checklist-banner";
import { AnimateIn } from "@/components/motion";
import { PageShell } from "@/components/page-shell";
import { ModeSwitch } from "@/components/segmented-control";
import { TriageInbox, type TriageRow } from "@/components/triage-inbox";

export function TodayTabs({
  mode,
  jobRows,
  leadRows,
  hasSearchProfile,
  checklistItems,
}: {
  mode: "jobs" | "clients";
  jobRows: JobTriageRow[];
  leadRows: TriageRow[];
  hasSearchProfile: boolean;
  checklistItems?: SetupChecklistItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [jobsSearching, setJobsSearching] = useState(false);
  const onSearchingChange = useCallback((next: boolean) => {
    setJobsSearching(next);
  }, []);

  const switchMode = (next: "jobs" | "clients") => {
    if (jobsSearching) return;
    startTransition(async () => {
      await setTodayModeAction(next);
      router.refresh();
    });
  };

  return (
    <PageShell>
      {checklistItems && checklistItems.length > 0 ? (
        <SetupChecklistBanner items={checklistItems} />
      ) : null}

      <div className="space-y-6">
        <ModeSwitch
          ariaLabel="Today view"
          value={mode}
          disabled={pending || jobsSearching}
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

        <AnimateIn key={mode} variant="fade">
          {mode === "jobs" ? (
            <JobsInbox
              rows={jobRows}
              hasSearchProfile={hasSearchProfile}
              onSearchingChange={onSearchingChange}
            />
          ) : (
            <TriageInbox rows={leadRows} embedded />
          )}
        </AnimateIn>
      </div>
    </PageShell>
  );
}
