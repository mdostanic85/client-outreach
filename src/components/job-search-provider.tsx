"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SearchExperience,
  type LiveSearchProgress,
  type SearchResultSummary,
} from "@/components/search-experience";
import type { JobPipelineStats } from "@/modules/jobs/pipeline";
import type { JobSearchProgress } from "@/modules/jobs/progress";
import type { RadarActivity } from "@/components/search-radar";
import type { SearchLiveStats } from "@/modules/search-experience/stages";
import { STRONG_MATCH_MIN, WORTH_A_LOOK_MIN } from "@/modules/matching/tiers";
import { createSessionStore } from "@/lib/session-store";

type SearchStreamEvent =
  | { type: "progress"; progress: JobSearchProgress }
  | { type: "done"; stats: JobPipelineStats }
  | { type: "error"; error: string };

const SLOW_MS = 90_000;
const ACTIVITY_LIMIT = 60;
const RESOLVE_HOLD_MS = 1_400;

export type JobSearchNotice = { error?: string | null; message?: string | null };

// Survives reloads within the tab so a finished run's message is still there.
const noticeStore = createSessionStore<JobSearchNotice>("optra.jobSearch.notice", {});

export type JobSearchOutcome = {
  strong: number;
  worth: number;
  finishedAt: string;
};

type JobSearchContextValue = {
  running: boolean;
  live: LiveSearchProgress | null;
  overlayOpen: boolean;
  notice: JobSearchNotice;
  lastOutcome: JobSearchOutcome | null;
  start: () => void;
  cancel: () => void;
  showOverlay: () => void;
  hideOverlay: () => void;
  setNotice: (next: JobSearchNotice) => void;
  /** Today already shows this action, so the topbar must not repeat it. */
  pageOwnsCta: boolean;
  claimPageCta: (owns: boolean) => void;
};

const JobSearchContext = createContext<JobSearchContextValue | null>(null);

export function useJobSearch(): JobSearchContextValue {
  const value = useContext(JobSearchContext);
  if (!value) throw new Error("useJobSearch must be used inside JobSearchProvider");
  return value;
}

const NETWORK_ERROR_PATTERN =
  /failed to fetch|network\s*error|networkerror|load failed|err_internet_disconnected|err_network|err_connection|net::err/i;

function formatJobSearchError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Job search was cancelled.";
  }
  // Browser dropped the connection (tab sleep, offline, proxy), OR the server
  // relayed a network failure from an upstream call (Google/Anthropic/Apify) —
  // either way this isn't a pipeline bug, so don't show the raw message.
  // Note: errors relayed via the NDJSON `error` event become plain `Error`s,
  // not `TypeError`s, so this check must not require `instanceof TypeError`.
  if (err instanceof Error && NETWORK_ERROR_PATTERN.test(err.message)) {
    return "Connection lost during search. Click Find jobs again.";
  }
  if (err instanceof Error && err.message.trim()) return err.message.slice(0, 400);
  return "Job search failed. Click Find jobs again.";
}

export function formatPipelineMessage(stats: JobPipelineStats): string {
  if (stats.skipped) {
    if (stats.skipped === "no_search_profile") return "Approve search criteria first.";
    if (stats.skipped === "budget") return "Monthly AI budget reached — try again later.";
    return `Skipped: ${stats.skipped}`;
  }
  const spend = stats.apifyCostUsd ? ` · Apify $${stats.apifyCostUsd.toFixed(2)} / $0.50` : "";
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

/**
 * Owns the job-discovery run for the whole app shell. Lives in the (app) layout,
 * so a search keeps streaming while the user moves between pages; the topbar
 * shows it compactly and the full-screen spotlight is optional.
 */
export function JobSearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<LiveSearchProgress | null>(null);
  const [resultSummary, setResultSummary] = useState<SearchResultSummary | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [slow, setSlow] = useState(false);
  const notice = noticeStore.useValue();
  const [lastOutcome, setLastOutcome] = useState<JobSearchOutcome | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!running || resultSummary) return;
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, [running, resultSummary]);

  // Leaving the tab mid-run would silently drop the stream; warn first.
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  const setNotice = useCallback((next: JobSearchNotice) => {
    noticeStore.set(prev => ({ ...prev, ...next }));
  }, []);

  const start = useCallback(() => {
    if (abortRef.current) return;
    setNotice({ error: null, message: null });
    cancelledRef.current = false;
    const abort = new AbortController();
    abortRef.current = abort;
    let acc: SearchLiveStats = {};
    let activity: RadarActivity[] = [];
    let seq = 0;
    setResultSummary(null);
    setSlow(false);
    setLive({ percent: 0, stepId: "collect", detail: "Starting search…" });
    setRunning(true);
    setOverlayOpen(true);

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
        const outcome: { stats: JobPipelineStats | null } = { stats: null };
        const takeLine = (line: string) => {
          if (!line.trim()) return;
          let event: SearchStreamEvent;
          try {
            event = JSON.parse(line) as SearchStreamEvent;
          } catch {
            return;
          }
          if (event.type === "progress") {
            if (event.progress.stats) acc = { ...acc, ...event.progress.stats };
            if (event.progress.activity) {
              activity = [{ ...event.progress.activity, id: ++seq }, ...activity].slice(0, ACTIVITY_LIMIT);
            }
            setLive({
              percent: event.progress.percent,
              stepId: event.progress.stepId,
              detail: event.progress.detail ?? event.progress.label,
              stats: acc,
              activity,
            });
          } else if (event.type === "done") {
            outcome.stats = event.stats;
            setLive({ percent: 100, stepId: "publish", detail: "Finishing up…", stats: acc, activity });
          } else {
            throw new Error(event.error);
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) takeLine(line);
        }
        buffer += decoder.decode();
        if (buffer.trim()) takeLine(buffer);

        if (cancelledRef.current) return;
        const stats = outcome.stats;
        if (!stats) {
          router.refresh();
          setNotice({
            error: "Search was cut off before it finished. Anything already saved is on your list — click Find jobs again for the rest.",
          });
          return;
        }
        const strong = stats.publishedStrong ?? 0;
        const worth = stats.publishedWorthALook ?? 0;
        const published = stats.published ?? strong + worth;
        const message = formatPipelineMessage(stats);
        setResultSummary({
          title:
            published === 0
              ? "No strong matches found"
              : strong > 0
                ? `Found ${strong} strong match${strong === 1 ? "" : "es"}`
                : `Found ${worth} worth a look`,
          detail: message,
        });
        setNotice({ error: null, message });
        if (!stats.skipped) setLastOutcome({ strong, worth, finishedAt: new Date().toISOString() });
        router.refresh();
        if (pathnameRef.current !== "/") {
          toast.success(published > 0 ? `${strong} strong · ${worth} worth a look` : "Search finished", {
            description: published > 0 ? "Your shortlist is updated." : message,
            action: { label: "View", onClick: () => router.push("/") },
          });
        }
        await new Promise(r => window.setTimeout(r, RESOLVE_HOLD_MS));
      } catch (err) {
        if (cancelledRef.current || abort.signal.aborted) return;
        const error = formatJobSearchError(err);
        setNotice({ error });
        if (pathnameRef.current !== "/") toast.error("Job search failed", { description: error });
      } finally {
        abortRef.current = null;
        setLive(null);
        setResultSummary(null);
        setOverlayOpen(false);
        setRunning(false);
      }
    })();
  }, [router, setNotice]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setLive(null);
    setResultSummary(null);
    setSlow(false);
    setOverlayOpen(false);
    setRunning(false);
  }, []);

  const showOverlay = useCallback(() => setOverlayOpen(true), []);
  const hideOverlay = useCallback(() => setOverlayOpen(false), []);
  const [pageOwnsCta, setPageOwnsCta] = useState(false);
  const claimPageCta = useCallback((owns: boolean) => {
    setPageOwnsCta(owns);
  }, []);

  const value = useMemo<JobSearchContextValue>(
    () => ({
      running,
      live,
      overlayOpen,
      notice,
      lastOutcome,
      start,
      cancel,
      showOverlay,
      hideOverlay,
      setNotice,
      pageOwnsCta,
      claimPageCta,
    }),
    [running, live, overlayOpen, notice, lastOutcome, start, cancel, showOverlay, hideOverlay, setNotice, pageOwnsCta, claimPageCta],
  );

  return (
    <JobSearchContext.Provider value={value}>
      {children}
      <SearchExperience
        open={running && overlayOpen}
        mode="jobs"
        onCancel={cancel}
        onMinimize={hideOverlay}
        live={live}
        resultSummary={resultSummary}
        slow={slow}
      />
    </JobSearchContext.Provider>
  );
}
