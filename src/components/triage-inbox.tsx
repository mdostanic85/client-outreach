"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Building2, ChevronDown, ExternalLink } from "lucide-react";
import { acceptLeadAction, rejectLeadAction, saveForLaterAction } from "@/modules/leads/actions";
import { DiscoverControls } from "@/components/discover-controls";
import { EmptyState } from "@/components/empty-state";
import { InlineAlert } from "@/components/inline-alert";
import { Stagger, StaggerItem } from "@/components/motion";
import {
  PageHeader,
  PageShell,
  Surface,
} from "@/components/page-shell";
import { ScoreBadge } from "@/components/score-badge";
import {
  SearchExperience,
  type LiveSearchProgress,
  type SearchResultSummary,
} from "@/components/search-experience";
import { SegmentedControl } from "@/components/segmented-control";
import { PolicyPill, StatePill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CompanySearchProgress } from "@/modules/companies/progress";
import type { SearchLiveStats } from "@/modules/search-experience/stages";

export type TriageRow = {
  leadId: string;
  companyName: string;
  domain: string | null;
  country: string | null;
  score: number | null;
  state: string;
  policy: string;
  oneLiner: string | null;
  topNeed: string | null;
  whyFit: string | null;
  unknowns: string[];
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  hasBrief: boolean;
};

type Filter = "all" | "new" | "saved";

type CompanyPipelineStats = {
  published?: number;
  rawCandidates?: number;
  deterministicallyRemoved?: number;
  triageRejected?: number;
  researched?: number;
  sourceErrors?: unknown[];
};

type SearchStreamEvent =
  | { type: "progress"; progress: CompanySearchProgress }
  | { type: "done"; stats: CompanyPipelineStats }
  | { type: "error"; error: string };

const SLOW_MS = 90_000;
const RESOLVE_HOLD_MS = 1_400;

const NETWORK_ERROR_PATTERN =
  /failed to fetch|network\s*error|networkerror|load failed|err_internet_disconnected|err_network|err_connection|net::err/i;

function formatCompanySearchError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Company search was cancelled.";
  }
  // Browser dropped the connection, OR the server relayed a network failure
  // from an upstream call — either way this isn't a pipeline bug. Errors
  // relayed via the NDJSON `error` event become plain `Error`s, not
  // `TypeError`s, so this check must not require `instanceof TypeError`.
  if (err instanceof Error && NETWORK_ERROR_PATTERN.test(err.message)) {
    return "Connection lost during search. Click Find companies again.";
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message.slice(0, 400);
  }
  return "Company search failed. Click Find companies again.";
}

function formatCompanyMessage(stats: CompanyPipelineStats): string {
  const published = stats.published ?? 0;
  const raw = stats.rawCandidates ?? 0;
  const removed =
    (stats.deterministicallyRemoved ?? 0) + (stats.triageRejected ?? 0);
  const sourceIssues = Array.isArray(stats.sourceErrors)
    ? stats.sourceErrors.length
    : 0;
  const issues =
    sourceIssues > 0
      ? ` · ${sourceIssues} source issue${sourceIssues === 1 ? "" : "s"}`
      : "";

  if (published === 0) {
    return `No companies to show — scanned ${raw}, removed ${removed}.${issues}`;
  }
  return `Found ${published} compan${published === 1 ? "y" : "ies"} (${raw} scanned · ${removed} removed)${issues}`;
}

export function TriageInbox({
  rows,
  embedded = false,
  onSearchingChange,
}: {
  rows: TriageRow[];
  /** When true, skip PageShell (parent already provides layout). */
  embedded?: boolean;
  onSearchingChange?: (searching: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searching, setSearching] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveSearchProgress | null>(
    null,
  );
  const [resultSummary, setResultSummary] =
    useState<SearchResultSummary | null>(null);
  const [slow, setSlow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const statsAccRef = useRef<SearchLiveStats>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showDiscover, setShowDiscover] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    onSearchingChange?.(searching);
  }, [searching, onSearchingChange]);

  useEffect(() => {
    if (!searching || resultSummary) return;
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, [searching, resultSummary]);

  const findCompanies = () => {
    setError(null);
    setMessage(null);
    cancelledRef.current = false;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    statsAccRef.current = {};
    setResultSummary(null);
    setSlow(false);
    setLiveProgress({
      percent: 0,
      stepId: "discover",
      detail: "Starting company search…",
    });
    setSearching(true);

    void (async () => {
      try {
        const res = await fetch("/api/companies/search", {
          method: "POST",
          signal: abort.signal,
          headers: { Accept: "application/x-ndjson" },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            text.slice(0, 200) || `Search failed (${res.status})`,
          );
        }
        if (!res.body) throw new Error("No progress stream from server");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalStats: CompanyPipelineStats | null = null;

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
              if (event.progress.stats) {
                statsAccRef.current = {
                  ...statsAccRef.current,
                  ...event.progress.stats,
                };
              }
              setLiveProgress({
                percent: event.progress.percent,
                stepId: event.progress.stepId,
                detail: event.progress.detail ?? event.progress.label,
                stats: { ...statsAccRef.current },
              });
            } else if (event.type === "done") {
              finalStats = event.stats;
              setLiveProgress({
                percent: 100,
                stepId: "publish",
                detail: "Finishing up…",
                stats: { ...statsAccRef.current },
              });
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          }
        }

        if (cancelledRef.current) return;
        if (!finalStats) {
          setError(
            "Company search ended without results. Click Find companies again.",
          );
          return;
        }

        const stats = finalStats;
        const published = stats.published ?? 0;
        const summary = formatCompanyMessage(stats);
        setResultSummary({
          title:
            published === 0
              ? "No strong companies found"
              : `Found ${published} compan${published === 1 ? "y" : "ies"}`,
          detail: summary,
        });
        setMessage(summary);
        router.refresh();
        await new Promise((r) => window.setTimeout(r, RESOLVE_HOLD_MS));
      } catch (err) {
        if (cancelledRef.current || abort.signal.aborted) return;
        setError(formatCompanySearchError(err));
      } finally {
        abortRef.current = null;
        setLiveProgress(null);
        setResultSummary(null);
        if (!cancelledRef.current) setSearching(false);
      }
    })();
  };

  const cancelSearch = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setLiveProgress(null);
    setResultSummary(null);
    setSlow(false);
    setSearching(false);
  };

  const filtered = useMemo(() => {
    if (filter === "saved") {
      return rows.filter((r) => r.state === "saved_for_later");
    }
    if (filter === "new") {
      return rows.filter((r) => r.state !== "saved_for_later");
    }
    return rows;
  }, [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      new: rows.filter((r) => r.state !== "saved_for_later").length,
      saved: rows.filter((r) => r.state === "saved_for_later").length,
    }),
    [rows],
  );

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    afterOk?: () => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else {
        afterOk?.();
        router.refresh();
      }
    });
  };

  const hasRows = rows.length > 0;
  const findLabel = pending || searching ? "Finding…" : "Refresh companies";

  const headerActions = hasRows ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        id="today-primary-action"
        size="lg"
        variant="outline"
        disabled={pending || searching}
        onClick={findCompanies}
      >
        {findLabel}
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setShowDiscover((v) => !v)}
      >
        {showDiscover ? "Hide" : "Add company"}
      </Button>
    </div>
  ) : null;

  const body = (
    <>
      <SearchExperience
        open={searching}
        mode="companies"
        onCancel={cancelSearch}
        live={liveProgress}
        resultSummary={resultSummary}
        slow={slow}
      />

      <PageHeader
        title="Today · Companies"
        description="Companies to research and email. Accept one to draft outreach — separate from job matches."
        actions={headerActions}
      />

      {showDiscover ? (
        <Surface className="px-5 py-5 sm:px-6">
          <DiscoverControls />
        </Surface>
      ) : null}

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {message && !searching ? (
        <InlineAlert variant="info">{message}</InlineAlert>
      ) : null}

      {rows.length === 0 ? (
        <Surface>
          <EmptyState
            title="No companies yet"
            description="Find companies to fill this inbox, or add a company URL."
            actionId="today-primary-action"
            actionLabel={searching ? "Finding…" : "Find companies"}
            pending={pending || searching}
            icon={
              <Building2 className="size-5" strokeWidth={1.5} />
            }
            onAction={findCompanies}
          />
          <div className="border-border border-t px-5 py-4 sm:px-6">
            <DiscoverControls />
          </div>
        </Surface>
      ) : (
        <Surface>
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <SegmentedControl
              ariaLabel="Client filters"
              value={filter}
              onChange={setFilter}
              size="sm"
              options={[
                { id: "all", label: "All", count: counts.all },
                { id: "new", label: "To review", count: counts.new },
                { id: "saved", label: "Saved", count: counts.saved },
              ]}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              className="py-12"
              title="Nothing in this filter"
              description="Try All or To review, or save a company for later."
              actionLabel="Show all"
              onAction={() => setFilter("all")}
            />
          ) : (
            <Stagger as="ul" className="divide-border divide-y">
              {filtered.map((row, index) => {
                const open = expandedId === row.leadId;
                const summary = row.topNeed ?? row.oneLiner;
                const meta = [row.domain, row.country]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <StaggerItem
                    key={row.leadId}
                    as="li"
                    index={index}
                    className="interactive-row"
                  >
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5 sm:py-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/leads/${row.leadId}`}
                                className="text-body-lg font-medium text-foreground hover:text-brand-ink"
                              >
                                {row.companyName}
                              </Link>
                              <StatePill state={row.state} />
                              {row.policy !== "draft_allowed" &&
                              row.policy !== "unknown" ? (
                                <PolicyPill policy={row.policy} />
                              ) : null}
                            </div>
                            {meta ? (
                              <p className="text-muted-foreground text-body">
                                {meta}
                              </p>
                            ) : null}
                          </div>
                          <ScoreBadge score={row.score} kind="fit" />
                        </div>

                        {summary ? (
                          <p
                            className={cn(
                              "text-muted-foreground text-body leading-relaxed",
                              !open && "line-clamp-2",
                            )}
                          >
                            {summary}
                          </p>
                        ) : null}

                        {open ? (
                          <div className="animate-expand border-border space-y-2 border-t pt-3 text-body">
                            {row.whyFit ? (
                              <p>
                                <span className="text-foreground font-medium">
                                  Why it fits ·{" "}
                                </span>
                                <span className="text-muted-foreground">
                                  {row.whyFit}
                                </span>
                              </p>
                            ) : null}
                            {row.unknowns.length > 0 ? (
                              <p className="text-warn">
                                Uncertainty · {row.unknowns.join(" · ")}
                              </p>
                            ) : null}
                            {row.sourceUrl ? (
                              <a
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                                href={row.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {row.sourceName}: {row.sourceTitle}
                                <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ) : null}
                            <Link
                              href={`/leads/${row.leadId}`}
                              className="text-brand-ink inline-flex text-body font-medium underline-offset-2 hover:underline"
                            >
                              Open company →
                            </Link>
                          </div>
                        ) : null}

                        {rejectingId === row.leadId ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Input
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reject reason (required)"
                              className="max-w-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={pending || !rejectReason.trim()}
                              onClick={() =>
                                run(
                                  () =>
                                    rejectLeadAction(
                                      row.leadId,
                                      rejectReason.trim(),
                                    ),
                                  () => {
                                    setRejectingId(null);
                                    setRejectReason("");
                                  },
                                )
                              }
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            disabled={pending || !row.hasBrief}
                            onClick={() =>
                              run(() => acceptLeadAction(row.leadId), () =>
                                router.push(`/leads/${row.leadId}`),
                              )
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending || !row.hasBrief}
                            onClick={() =>
                              run(() => saveForLaterAction(row.leadId))
                            }
                          >
                            Later
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => {
                              setRejectingId(row.leadId);
                              setRejectReason("");
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-body-sm font-medium"
                          onClick={() =>
                            setExpandedId(open ? null : row.leadId)
                          }
                        >
                          {open ? "Less" : "Details"}
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200 ease-standard",
                              open && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </button>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </Surface>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-5">{body}</div>;
  }

  return <PageShell>{body}</PageShell>;
}
