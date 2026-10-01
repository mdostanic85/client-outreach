"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LiveSearchProgress, SearchResultSummary } from "@/components/search-experience";
import type { CompanyPipelineStats, CompanySearchProgress } from "@/modules/companies/progress";
import type { SearchLiveStats } from "@/modules/search-experience/stages";
import { describeSearchError, readSearchStream } from "@/modules/search-experience/stream";

const SLOW_MS = 90_000;
const RESOLVE_HOLD_MS = 1_400;

export function formatCompanyMessage(stats: CompanyPipelineStats): string {
  const published = stats.published ?? 0;
  const raw = stats.rawCandidates ?? 0;
  const removed = (stats.deterministicallyRemoved ?? 0) + (stats.triageRejected ?? 0);
  const sourceIssues = Array.isArray(stats.sourceErrors) ? stats.sourceErrors.length : 0;
  const issues =
    sourceIssues > 0 ? ` · ${sourceIssues} source issue${sourceIssues === 1 ? "" : "s"}` : "";

  if (published === 0) {
    return `No companies to show — scanned ${raw}, removed ${removed}.${issues}`;
  }
  return `Found ${published} compan${published === 1 ? "y" : "ies"} (${raw} scanned · ${removed} removed)${issues}`;
}

/**
 * Find companies: streams the company pipeline (`/api/companies/search`),
 * keeps live progress for the spotlight, and refreshes Today when done.
 */
export function useCompanySearch({
  onError,
  onMessage,
}: {
  onError: (error: string | null) => void;
  onMessage: (message: string | null) => void;
}) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveSearchProgress | null>(null);
  const [resultSummary, setResultSummary] = useState<SearchResultSummary | null>(null);
  const [slow, setSlow] = useState(false);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!searching || resultSummary) return;
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, [searching, resultSummary]);

  const findCompanies = () => {
    onError(null);
    onMessage(null);
    cancelledRef.current = false;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    let acc: SearchLiveStats = {};
    setResultSummary(null);
    setSlow(false);
    setLiveProgress({ percent: 0, stepId: "discover", detail: "Starting company search…" });
    setSearching(true);

    void (async () => {
      try {
        const stats = await readSearchStream<CompanySearchProgress, CompanyPipelineStats>(
          "/api/companies/search",
          {
            signal: abort.signal,
            onProgress: (progress) => {
              if (progress.stats) acc = { ...acc, ...progress.stats };
              setLiveProgress({
                percent: progress.percent,
                stepId: progress.stepId,
                detail: progress.detail ?? progress.label,
                stats: { ...acc },
              });
            },
          },
        );

        if (cancelledRef.current) return;
        if (!stats) {
          onError("Company search ended without results. Click Find companies again.");
          return;
        }
        setLiveProgress({ percent: 100, stepId: "publish", detail: "Finishing up…", stats: { ...acc } });

        const published = stats.published ?? 0;
        const summary = formatCompanyMessage(stats);
        setResultSummary({
          title:
            published === 0
              ? "No strong companies found"
              : `Found ${published} compan${published === 1 ? "y" : "ies"}`,
          detail: summary,
        });
        onMessage(summary);
        router.refresh();
        await new Promise((r) => window.setTimeout(r, RESOLVE_HOLD_MS));
      } catch (err) {
        if (cancelledRef.current || abort.signal.aborted) return;
        onError(
          describeSearchError(err, {
            cancelled: "Company search was cancelled.",
            retry: "Click Find companies again.",
            failed: "Company search failed. Click Find companies again.",
          }),
        );
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

  return { searching, liveProgress, resultSummary, slow, findCompanies, cancelSearch };
}
