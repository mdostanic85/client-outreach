"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Briefcase, Search } from "lucide-react";
import {
  interestedJobAction,
  markJobAppliedAction,
  rejectJobAction,
  runJobPipelineAction,
  saveJobForLaterAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { SectionTitle, Surface } from "@/components/page-shell";
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

  const findJobs = () => run(async () => runJobPipelineAction());

  const visible = useMemo(
    () => rows.filter((r) => r.triageState !== "rejected"),
    [rows],
  );

  const isEmpty = visible.length === 0;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Today · Jobs"
        description="Up to 20 strong matches each day. Weak fits stay off the list."
        actions={
          !isEmpty ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !hasSearchProfile}
              onClick={findJobs}
            >
              Find jobs
            </Button>
          ) : null
        }
      />

      {error ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-[14px]">
          {error}
        </p>
      ) : null}

      {!hasSearchProfile ? (
        <Surface className="px-5 py-4">
          <p className="text-[14px] leading-relaxed">
            Approve your{" "}
            <Link href="/search-criteria" className="text-primary underline-offset-4 hover:underline">
              search criteria
            </Link>{" "}
            before finding jobs.
          </p>
        </Surface>
      ) : null}

      {isEmpty ? (
        <Surface>
          {hasSearchProfile ? (
            <EmptyState
              title="No matches yet"
              description="Run a search now, or wait for the next daily run. Only strong fits show up here."
              icon={
                <Briefcase className="size-6 opacity-70" strokeWidth={1.5} />
              }
              actionId="today-primary-action"
              actionLabel={pending ? "Finding…" : "Find jobs"}
              pending={pending}
              onAction={findJobs}
            />
          ) : (
            <EmptyState
              title="No matches yet"
              description="Generate and approve search criteria first, then find jobs."
              icon={<Search className="size-6 opacity-70" strokeWidth={1.5} />}
              actionId="today-primary-action"
              actionLabel="Set search criteria"
              onAction={() => router.push("/search-criteria")}
            />
          )}
        </Surface>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const expanded = expandedId === row.jobId;
            return (
              <Surface key={row.jobId} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-white/3"
                  onClick={() =>
                    setExpandedId(expanded ? null : row.jobId)
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {row.companyName}
                        {row.location ? ` · ${row.location}` : ""}
                        {row.remotePolicy ? ` · ${row.remotePolicy}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
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
                      <p className="text-muted-foreground text-[11px] uppercase">
                        {row.recommendation ?? row.triageState}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="space-y-3 border-t px-4 py-3">
                    {row.matchingReasons.length > 0 ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium">
                          Why it matches
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {row.matchingReasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {row.concerns.length > 0 ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium">
                          Things to watch
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
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
                        className="text-muted-foreground hover:bg-muted inline-flex h-[34px] items-center rounded-lg px-3 text-[14px]"
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
                      <div className="flex items-center gap-2">
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
    </div>
  );
}
