"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Briefcase, Search } from "lucide-react";
import {
  interestedJobAction,
  markJobAppliedAction,
  rejectJobAction,
  saveJobForLaterAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { InlineAlert } from "@/components/inline-alert";
import { JobListItem } from "@/components/job-list-item";
import { Stagger, StaggerItem } from "@/components/motion";
import { PageHeader, Surface } from "@/components/page-shell";
import {
  SearchProgressModal,
  type LiveSearchProgress,
} from "@/components/search-progress-modal";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import type { JobPipelineStats } from "@/modules/jobs/pipeline";
import type { JobSearchProgress } from "@/modules/jobs/progress";
import type { RemoteFit } from "@/modules/matching/remote-fit";
import {
  STRONG_MATCH_MIN,
  WORTH_A_LOOK_MIN,
  matchTierForScore,
} from "@/modules/matching/tiers";

type SearchStreamEvent =
  | { type: "progress"; progress: JobSearchProgress }
  | { type: "done"; stats: JobPipelineStats }
  | { type: "error"; error: string };

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
  remoteFit: RemoteFit;
  mainRisk: string | null;
  missingRequirements: string[];
  remoteRequired: boolean;
  postedAt: string | null;
  triageState: string;
};

type InboxTab = "strong" | "worth_a_look" | "all";

function formatPipelineMessage(stats: {
  skipped?: string;
  raw?: number;
  keptAfterFilter?: number;
  evaluated?: number;
  published?: number;
  publishedStrong?: number;
  publishedWorthALook?: number;
  apifyCostUsd?: number;
}): string {
  if (stats.skipped) {
    if (stats.skipped === "no_search_profile") {
      return "Approve search criteria first.";
    }
    if (stats.skipped === "budget") {
      return "Monthly AI budget reached — try again later.";
    }
    return `Skipped: ${stats.skipped}`;
  }

  const spend =
    stats.apifyCostUsd != null
      ? ` · Apify $${stats.apifyCostUsd.toFixed(2)} / $0.50`
      : "";
  const strong = stats.publishedStrong ?? 0;
  const worth = stats.publishedWorthALook ?? 0;
  const published = stats.published ?? strong + worth;

  if (published === 0) {
    return `No matches to show — scanned ${stats.raw ?? 0}, kept ${stats.keptAfterFilter ?? 0}, scored ${stats.evaluated ?? 0}. Strong is ${STRONG_MATCH_MIN}+; Worth a look is ${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1}.${spend}`;
  }

  if (strong === 0 && worth > 0) {
    return `No strong matches (${STRONG_MATCH_MIN}+), but ${worth} worth a look (${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1}). Scanned ${stats.raw ?? 0} · scored ${stats.evaluated ?? 0}.${spend}`;
  }

  return `Found ${strong} strong · ${worth} worth a look (${stats.raw ?? 0} scanned · ${stats.evaluated ?? 0} scored)${spend}`;
}

const STATUS_KEY = "optra.jobsInbox.status";

type PersistedStatus = {
  error?: string | null;
  message?: string | null;
  tab?: InboxTab;
};

function readPersistedStatus(): PersistedStatus {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as PersistedStatus) : {};
  } catch {
    return {};
  }
}

function writePersistedStatus(next: PersistedStatus) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STATUS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function JobsInbox({
  rows,
  hasSearchProfile,
  onSearchingChange,
}: {
  rows: JobTriageRow[];
  hasSearchProfile: boolean;
  /** Notify parent so navigation/tabs can stay put during sync (Klaviyo-style). */
  onSearchingChange?: (searching: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searching, setSearching] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveSearchProgress | null>(
    null,
  );
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onSearchingChange?.(searching);
  }, [searching, onSearchingChange]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<InboxTab>("strong");

  useEffect(() => {
    const saved = readPersistedStatus();
    if (saved.error) setError(saved.error);
    if (saved.message) setMessage(saved.message);
    if (saved.tab) setTab(saved.tab);
  }, []);

  const persistStatus = (
    next: Partial<{ error: string | null; message: string | null; tab: InboxTab }>,
  ) => {
    if (next.error !== undefined) setError(next.error);
    if (next.message !== undefined) setMessage(next.message);
    if (next.tab !== undefined) setTab(next.tab);
    writePersistedStatus({
      error: next.error !== undefined ? next.error : error,
      message: next.message !== undefined ? next.message : message,
      tab: next.tab !== undefined ? next.tab : tab,
    });
  };

  const findJobs = () => {
    persistStatus({ error: null, message: null });
    cancelledRef.current = false;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setLiveProgress({
      percent: 0,
      stepId: "collect",
      detail: "Starting search…",
    });
    setSearching(true);

    void (async () => {
      try {
        const res = await fetch("/api/jobs/search", {
          method: "POST",
          signal: abort.signal,
          headers: { Accept: "application/x-ndjson" },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text.slice(0, 200) || `Search failed (${res.status})`);
        }
        if (!res.body) throw new Error("No progress stream from server");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalStats: JobPipelineStats | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: SearchStreamEvent;
            try {
              event = JSON.parse(line) as SearchStreamEvent;
            } catch {
              continue;
            }
            if (event.type === "progress") {
              setLiveProgress({
                percent: event.progress.percent,
                stepId: event.progress.stepId,
                detail: event.progress.detail ?? event.progress.label,
              });
            } else if (event.type === "done") {
              finalStats = event.stats;
              setLiveProgress({
                percent: 100,
                stepId: "publish",
                detail: "Finishing up…",
              });
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          }
        }

        if (cancelledRef.current) return;
        if (!finalStats) {
          persistStatus({
            error: "Job search ended without results. Click Find jobs again.",
          });
          return;
        }

        const stats = finalStats;
        const nextTab =
          (stats.publishedStrong ?? 0) === 0 &&
          (stats.publishedWorthALook ?? 0) > 0
            ? ("worth_a_look" as const)
            : (stats.publishedStrong ?? 0) > 0
              ? ("strong" as const)
              : tab;
        persistStatus({
          error: null,
          message: formatPipelineMessage(stats),
          tab: nextTab,
        });
        router.refresh();
        await new Promise((r) => window.setTimeout(r, 450));
      } catch (err) {
        if (cancelledRef.current || abort.signal.aborted) return;
        const text =
          err instanceof Error
            ? err.message
            : "Job search was interrupted (server reload). Click Find jobs again.";
        persistStatus({
          error: /fetch|network|abort|interrupt|reload/i.test(text)
            ? "Job search was interrupted (dev server reloaded mid-run). Click Find jobs again."
            : text,
        });
      } finally {
        abortRef.current = null;
        setLiveProgress(null);
        if (!cancelledRef.current) setSearching(false);
      }
    })();
  };

  const cancelSearch = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setLiveProgress(null);
    setSearching(false);
  };

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMessage?: string,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else {
        if (okMessage) persistStatus({ message: okMessage });
        router.refresh();
      }
    });
  };

  const visible = useMemo(
    () => rows.filter((r) => r.triageState !== "rejected"),
    [rows],
  );

  const strongRows = useMemo(
    () =>
      visible.filter(
        (r) => matchTierForScore(r.matchScore) === "strong",
      ),
    [visible],
  );

  const worthRows = useMemo(
    () =>
      visible.filter(
        (r) => matchTierForScore(r.matchScore) === "worth_a_look",
      ),
    [visible],
  );

  const listed = useMemo(() => {
    if (tab === "strong") return strongRows;
    if (tab === "worth_a_look") return worthRows;
    return [...strongRows, ...worthRows];
  }, [tab, strongRows, worthRows]);

  useEffect(() => {
    if (searching) return;
    if (strongRows.length === 0 && worthRows.length > 0 && tab === "strong") {
      setTab("worth_a_look");
      writePersistedStatus({
        error,
        message,
        tab: "worth_a_look",
      });
    }
  }, [strongRows.length, worthRows.length, searching, tab, error, message]);

  const isEmpty = visible.length === 0;
  const showFallbackBanner =
    !searching &&
    !isEmpty &&
    strongRows.length === 0 &&
    worthRows.length > 0;

  const primaryAction = !hasSearchProfile ? (
    <Button
      id="today-primary-action"
      size="lg"
      onClick={() => router.push("/search-criteria")}
    >
      Set search criteria
    </Button>
  ) : isEmpty ? (
    <Button
      id="today-primary-action"
      size="lg"
      disabled={pending || searching}
      onClick={findJobs}
    >
      {pending || searching ? "Finding…" : "Find jobs"}
    </Button>
  ) : (
    <Button
      id="today-primary-action"
      size="lg"
      variant="outline"
      disabled={pending || searching}
      onClick={findJobs}
    >
      {pending || searching ? "Finding…" : "Refresh jobs"}
    </Button>
  );

  return (
    <div className="space-y-5">
      <SearchProgressModal
        open={searching}
        mode="jobs"
        onCancel={cancelSearch}
        live={liveProgress}
      />

      <PageHeader
        title="Today · Jobs"
        description="Shortlist of roles scored against your profile. Review, save, or skip — nothing applies itself."
        actions={primaryAction}
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {message && !searching ? (
        <InlineAlert variant="info">
          {message.includes("Interested") ? (
            <>
              Moved to{" "}
              <Link
                href="/interested"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Interested
              </Link>
              — find it in the sidebar.
            </>
          ) : (
            message
          )}
        </InlineAlert>
      ) : null}

      {!hasSearchProfile ? (
        <Surface className="px-5 py-4">
          <p className="text-[14px] leading-relaxed">
            Approve your{" "}
            <Link
              href="/search-criteria"
              className="text-primary underline-offset-4 hover:underline"
            >
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
              description={`Run a search now. Strong fits (${STRONG_MATCH_MIN}+) and worth-a-look (${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1}) show in separate tabs.`}
              icon={
                <Briefcase className="size-6 opacity-70" strokeWidth={1.5} />
              }
              actionLabel="Find jobs"
              pending={pending}
              onAction={findJobs}
            />
          ) : (
            <EmptyState
              title="No matches yet"
              description="Generate and approve search criteria first, then find jobs."
              icon={<Search className="size-6 opacity-70" strokeWidth={1.5} />}
              actionLabel="Set search criteria"
              onAction={() => router.push("/search-criteria")}
            />
          )}
        </Surface>
      ) : null}

      {!isEmpty ? (
        <div className="space-y-4">
          <SegmentedControl
            ariaLabel="Match quality"
            value={tab}
            onChange={setTab}
            options={[
              {
                id: "strong",
                label: "Strong matches",
                count: strongRows.length,
              },
              {
                id: "worth_a_look",
                label: "Worth a look",
                count: worthRows.length,
              },
              {
                id: "all",
                label: "All",
                count: strongRows.length + worthRows.length,
              },
            ]}
          />

          <p className="text-muted-foreground text-[15px] leading-relaxed">
            {tab === "strong"
              ? `Browse roles that match your profile closely. Ordered by score (${STRONG_MATCH_MIN}+).`
              : tab === "worth_a_look"
                ? "Weaker or ambiguous fits. Check remote chips and Things to watch before you apply."
                : "Strong first, then worth a look — same triage actions on every card."}
          </p>

          {showFallbackBanner && tab !== "worth_a_look" ? (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-3 text-[14px] leading-relaxed text-sky-950 dark:text-sky-100">
              No strong matches ({STRONG_MATCH_MIN}+) today —{" "}
              <button
                type="button"
                className="font-medium underline-offset-4 hover:underline"
                onClick={() => setTab("worth_a_look")}
              >
                {worthRows.length} worth a look
              </button>{" "}
              below the bar, with caveats.
            </div>
          ) : null}

          {listed.length === 0 ? (
            <Surface className="px-5 py-8">
              <p className="text-muted-foreground text-center text-[14px]">
                {tab === "strong"
                  ? `No strong matches yet. Check Worth a look, or run Find jobs again.`
                  : tab === "worth_a_look"
                    ? `Nothing in the ${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1} band right now.`
                    : "No published matches in either band."}
              </p>
            </Surface>
          ) : (
            <Stagger className="space-y-3">
              {listed.map((row, index) => (
                <StaggerItem key={row.jobId} index={index}>
                  <JobListItem
                    variant="today"
                    row={row}
                    expanded={expandedId === row.jobId}
                    pending={pending}
                    rejecting={rejectingId === row.jobId}
                    rejectReason={rejectReason}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === row.jobId ? null : row.jobId,
                      )
                    }
                    onInterested={() =>
                      run(
                        async () => interestedJobAction(row.jobId),
                        "Moved to Interested — find it in the sidebar.",
                      )
                    }
                    onSaveForLater={() =>
                      run(async () => saveJobForLaterAction(row.jobId))
                    }
                    onAlreadyApplied={() =>
                      run(async () => markJobAppliedAction(row.jobId))
                    }
                    onStartReject={() => {
                      setRejectingId(row.jobId);
                      setRejectReason("");
                    }}
                    onRejectReason={setRejectReason}
                    onConfirmReject={() =>
                      run(async () => {
                        const res = await rejectJobAction(
                          row.jobId,
                          rejectReason,
                        );
                        setRejectingId(null);
                        return res;
                      })
                    }
                    onCancelReject={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      ) : null}
    </div>
  );
}
