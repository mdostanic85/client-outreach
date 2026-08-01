"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  interestedJobAction,
  markJobAppliedAction,
  rejectJobAction,
  runJobPipelineAction,
  saveJobForLaterAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import {
  PageHeader,
  PageShell,
  Surface,
} from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type JobTriageRow = {
  jobId: string;
  title: string;
  companyName: string;
  location: string | null;
  remotePolicy: string | null;
  employmentType: string | null;
  source: string;
  sourceUrl: string;
  matchScore: number | null;
  eligibility: string | null;
  recommendation: string | null;
  matchingReasons: string[];
  concerns: string[];
  postedAt: string | null;
  triageState: string;
};

export function JobsInbox({
  rows,
  hasSearchProfile,
}: {
  rows: JobTriageRow[];
  hasSearchProfile: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else router.refresh();
    });
  };

  const visible = useMemo(
    () => rows.filter((r) => r.triageState !== "rejected"),
    [rows],
  );

  return (
    <PageShell>
      <PageHeader
        title="Today · Jobs"
        description="Up to 20 strong matches a day. Weak fits stay out."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !hasSearchProfile}
            onClick={() => run(async () => runJobPipelineAction())}
          >
            Find jobs
          </Button>
        }
      />

      {error ? (
        <p className="text-sm text-destructive mb-4">{error}</p>
      ) : null}

      {!hasSearchProfile ? (
        <Surface className="mb-6 p-4">
          <p className="text-sm">
            Approve your{" "}
            <Link href="/search-criteria" className="underline">
              search criteria
            </Link>{" "}
            before we look for jobs.
          </p>
        </Surface>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title="No job matches yet"
          description={
            hasSearchProfile
              ? "Tap Find jobs, or wait for the next daily run."
              : "Generate and approve search criteria first."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const expanded = expandedId === row.jobId;
            return (
              <Surface key={row.jobId} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-white/3"
                  onClick={() =>
                    setExpandedId(expanded ? null : row.jobId)
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.companyName}
                        {row.location ? ` · ${row.location}` : ""}
                        {row.remotePolicy ? ` · ${row.remotePolicy}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {row.matchScore != null ? (
                        <p
                          className={cn(
                            "tabular text-lg font-semibold",
                            row.matchScore >= 80
                              ? "text-primary"
                              : "text-foreground",
                          )}
                        >
                          {row.matchScore}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground uppercase">
                        {row.recommendation ?? row.triageState}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t px-4 py-3 space-y-3">
                    {row.matchingReasons.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Why it matches
                        </p>
                        <ul className="text-sm list-disc pl-5 space-y-1">
                          {row.matchingReasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {row.concerns.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Things to watch
                        </p>
                        <ul className="text-sm list-disc pl-5 space-y-1">
                          {row.concerns.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(async () => interestedJobAction(row.jobId))
                        }
                      >
                        Interested
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          run(async () => saveJobForLaterAction(row.jobId))
                        }
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(async () => markJobAppliedAction(row.jobId))
                        }
                      >
                        Already applied
                      </Button>
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-[34px] items-center rounded-lg px-3 text-[14px] text-muted-foreground hover:bg-muted"
                      >
                        Open posting
                      </a>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          setRejectingId(row.jobId);
                          setRejectReason("");
                        }}
                      >
                        Not interested
                      </Button>
                    </div>
                    {rejectingId === row.jobId ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Reason (required)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={pending || !rejectReason.trim()}
                          onClick={() =>
                            run(async () => {
                              const res = await rejectJobAction(
                                row.jobId,
                                rejectReason,
                              );
                              setRejectingId(null);
                              return res;
                            })
                          }
                        >
                          Confirm
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Surface>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
