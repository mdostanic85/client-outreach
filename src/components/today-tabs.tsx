"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setTodayModeAction } from "@/app/actions";
import { JobsInbox, type JobTriageRow } from "@/components/jobs-inbox";
import type { SetupChecklistItem } from "@/modules/onboarding/state";
import { SetupChecklistBanner } from "@/components/onboarding/setup-checklist-banner";
import { PageShell } from "@/components/page-shell";
import { TriageInbox, type TriageRow } from "@/components/triage-inbox";
import { cn } from "@/lib/utils";

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

  const switchMode = (next: "jobs" | "clients") => {
    startTransition(async () => {
      await setTodayModeAction(next);
      router.refresh();
    });
  };

  return (
    <PageShell className="gap-6 lg:gap-8">
      {checklistItems && checklistItems.length > 0 ? (
        <SetupChecklistBanner items={checklistItems} />
      ) : null}

      <div className="space-y-6">
        <div
          role="tablist"
          aria-label="Today view"
          className="bg-muted/50 border-border inline-flex rounded-xl border p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "jobs"}
            disabled={pending}
            onClick={() => switchMode("jobs")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              mode === "jobs"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Jobs
            {jobRows.length > 0 ? (
              <span className="ml-1.5 tabular opacity-80">{jobRows.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "clients"}
            disabled={pending}
            onClick={() => switchMode("clients")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              mode === "clients"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Clients
            {leadRows.length > 0 ? (
              <span className="ml-1.5 tabular opacity-80">{leadRows.length}</span>
            ) : null}
          </button>
        </div>

        {mode === "jobs" ? (
          <JobsInbox rows={jobRows} hasSearchProfile={hasSearchProfile} />
        ) : (
          <TriageInbox rows={leadRows} embedded />
        )}
      </div>
    </PageShell>
  );
}
