"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setTodayModeAction } from "@/app/actions";
import { JobsInbox, type JobTriageRow } from "@/components/jobs-inbox";
import { TriageInbox, type TriageRow } from "@/components/triage-inbox";
import { cn } from "@/lib/utils";

export function TodayTabs({
  mode,
  jobRows,
  leadRows,
  hasSearchProfile,
}: {
  mode: "jobs" | "clients";
  jobRows: JobTriageRow[];
  leadRows: TriageRow[];
  hasSearchProfile: boolean;
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
    <div>
      <div className="flex gap-2 px-1 mb-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => switchMode("jobs")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "jobs"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-white/5",
          )}
        >
          Jobs
          {jobRows.length > 0 ? (
            <span className="ml-1.5 opacity-80">{jobRows.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => switchMode("clients")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "clients"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-white/5",
          )}
        >
          Clients
          {leadRows.length > 0 ? (
            <span className="ml-1.5 opacity-80">{leadRows.length}</span>
          ) : null}
        </button>
      </div>

      {mode === "jobs" ? (
        <JobsInbox rows={jobRows} hasSearchProfile={hasSearchProfile} />
      ) : (
        <TriageInbox rows={leadRows} />
      )}
    </div>
  );
}
