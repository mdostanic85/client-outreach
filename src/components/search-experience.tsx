"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SEARCH_UX_STAGES,
  stageIndex,
  uxStageFromCompanyStep,
  uxStageFromJobStep,
  type SearchLiveStats,
  type SearchUxStageId,
} from "@/modules/search-experience/stages";

export type SearchExperienceMode = "jobs" | "companies";

export type LiveSearchProgress = {
  percent: number | null;
  stepId: string;
  detail?: string;
  stats?: SearchLiveStats;
};

export type SearchResultSummary = {
  title: string;
  detail?: string;
  strong?: number;
  secondary?: number;
  empty?: boolean;
};

type SearchExperienceProps = {
  open: boolean;
  mode: SearchExperienceMode;
  onCancel: () => void;
  live?: LiveSearchProgress | null;
  resultSummary?: SearchResultSummary | null;
  slow?: boolean;
};

type SpotlightFrame = {
  stageId: SearchUxStageId;
  detail: string;
  phase: "enter" | "idle" | "exit";
};

/**
 * Stage Spotlight — immersive sequential search UI.
 * Refs: Klaviyo welcome series, Remote resume upload, HubSpot brand voice,
 * Artlist hold-tight, Profound workflow progress — one large phase at a time.
 */
export function SearchExperience({
  open,
  mode,
  onCancel,
  live = null,
  resultSummary = null,
  slow = false,
}: SearchExperienceProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  // Unmount when closed so each open starts a fresh stage choreography.
  return createPortal(
    <SearchExperienceInner
      titleId={titleId}
      mode={mode}
      onCancel={onCancel}
      live={live}
      resultSummary={resultSummary}
      slow={slow}
    />,
    document.body,
  );
}

function SearchExperienceInner({
  titleId,
  mode,
  onCancel,
  live,
  resultSummary,
  slow,
}: {
  titleId: string;
  mode: SearchExperienceMode;
  onCancel: () => void;
  live: LiveSearchProgress | null;
  resultSummary: SearchResultSummary | null;
  slow: boolean;
}) {
  const resolving = Boolean(resultSummary);
  const percent =
    live?.percent == null
      ? null
      : Math.max(0, Math.min(100, Math.round(live.percent)));

  const targetStageId: SearchUxStageId = useMemo(() => {
    if (resolving) return "prepare";
    const stepId = live?.stepId ?? (mode === "jobs" ? "collect" : "discover");
    const p = percent ?? 0;
    return mode === "jobs"
      ? uxStageFromJobStep(stepId, p)
      : uxStageFromCompanyStep(stepId, p);
  }, [live?.stepId, mode, percent, resolving]);

  const targetDetail = resolving
    ? (resultSummary?.detail ?? "Preparing your recommendations…")
    : (live?.detail ??
      (mode === "jobs"
        ? SEARCH_UX_STAGES.find((s) => s.id === targetStageId)?.jobsHint
        : SEARCH_UX_STAGES.find((s) => s.id === targetStageId)?.companiesHint) ??
      "Working…");

  const frame = useSpotlightChoreography(targetStageId, targetDetail);
  const activeIdx = stageIndex(frame.stageId);
  const currentStage = SEARCH_UX_STAGES[activeIdx] ?? SEARCH_UX_STAGES[0];
  const stepLabel = String(activeIdx + 1).padStart(2, "0");
  const stats = live?.stats ?? {};

  const headline = resolving
    ? resultSummary?.empty
      ? "No strong matches"
      : (resultSummary?.title ?? "Ready")
    : currentStage.label;

  const liveDetail =
    frame.phase === "exit" ? frame.detail : targetDetail;

  return (
    <div
      className="animate-in fade-in duration-300 fixed inset-0 z-50 flex flex-col"
      role="presentation"
    >
      <div className="bg-background absolute inset-0" aria-hidden />
      <div className="stage-spotlight-wash pointer-events-none absolute inset-0" aria-hidden />
      <div className="stage-spotlight-grid pointer-events-none absolute inset-0" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={!resolving}
        className="relative z-10 flex min-h-0 flex-1 flex-col"
      >
        {/* Chrome */}
        <header className="flex shrink-0 items-center justify-between gap-4 px-5 pt-5 sm:px-10 sm:pt-7">
          <div className="min-w-0">
            <p className="font-display text-[15px] font-semibold tracking-tight text-[var(--card-foreground)] sm:text-[17px]">
              {mode === "jobs" ? "Finding jobs" : "Finding companies"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[13px]">
              Step {activeIdx + 1} of {SEARCH_UX_STAGES.length}
              {slow && !resolving ? " · Taking longer than usual" : null}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="gap-1.5"
          >
            <X className="size-3.5" strokeWidth={2} />
            Cancel
          </Button>
        </header>

        {/* Body: rail + spotlight */}
        <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[minmax(240px,280px)_1fr] lg:gap-10 lg:px-10 lg:py-8">
          {/* Vertical phase rail — Profound / Klaviyo */}
          <aside className="hidden min-h-0 lg:block" aria-label="Search stages">
            <ol className="stage-rail relative flex h-full flex-col justify-center gap-0 py-2">
              {SEARCH_UX_STAGES.map((stage, index) => {
                const done = index < activeIdx || resolving;
                const current = index === activeIdx && !resolving;
                const upcoming = index > activeIdx && !resolving;
                return (
                  <li
                    key={stage.id}
                    className={cn(
                      "stage-rail-item relative flex gap-3 py-2.5 pl-1",
                      current && "stage-rail-item-active",
                      done && "stage-rail-item-done",
                    )}
                  >
                    <div className="relative flex w-7 shrink-0 flex-col items-center">
                      <span
                        className={cn(
                          "relative z-10 flex size-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-500",
                          done &&
                            "border-primary bg-primary text-primary-foreground",
                          current &&
                            "border-primary bg-primary/15 text-primary ring-primary/25 ring-4",
                          upcoming &&
                            "border-border bg-card text-muted-foreground/50",
                        )}
                      >
                        {done ? (
                          <Check className="size-3.5" strokeWidth={2.5} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {index < SEARCH_UX_STAGES.length - 1 ? (
                        <span
                          className={cn(
                            "absolute top-7 bottom-[-14px] w-px",
                            done ? "bg-primary/50" : "bg-border",
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={cn(
                          "text-[13px] leading-snug font-medium transition-colors duration-400",
                          current && "text-foreground",
                          done && "text-muted-foreground",
                          upcoming && "text-muted-foreground/45",
                        )}
                      >
                        {stage.label}
                      </p>
                      {current ? (
                        <p className="text-muted-foreground stage-rail-hint mt-1 text-[12px] leading-relaxed">
                          {mode === "jobs" ? stage.jobsHint : stage.companiesHint}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* Spotlight — one large phase */}
          <div className="relative flex min-h-0 flex-col items-center justify-center text-center">
            <div
              className={cn(
                "stage-spotlight-panel w-full max-w-2xl",
                frame.phase === "enter" && "stage-spotlight-enter",
                frame.phase === "exit" && "stage-spotlight-exit",
                frame.phase === "idle" && "stage-spotlight-idle",
              )}
            >
              {/* Square / Etsy — progress arc around the stage mark */}
              <StageProgressRing percent={percent} resolving={resolving}>
                <p
                  className={cn(
                    "stage-spotlight-num font-display tabular text-[72px] leading-none font-semibold tracking-tighter sm:text-[96px]",
                    resolving ? "text-primary/50" : "text-primary/35",
                  )}
                  aria-hidden
                >
                  {resolving ? (
                    <Check
                      className="text-primary stage-spotlight-check mx-auto size-16 sm:size-20"
                      strokeWidth={2}
                    />
                  ) : (
                    stepLabel
                  )}
                </p>
              </StageProgressRing>

              <h2
                id={titleId}
                className="font-display mt-2 text-[32px] leading-[1.1] font-semibold tracking-tight text-[var(--card-foreground)] sm:mt-3 sm:text-[48px]"
              >
                {headline}
              </h2>

              <p
                className="text-muted-foreground mx-auto mt-4 min-h-[3.5rem] max-w-xl text-[17px] leading-relaxed sm:text-[20px]"
                aria-live="polite"
              >
                {liveDetail}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
                {stats.reviewed != null ? (
                  <Badge
                    variant="outline"
                    className="tabular h-9 px-3.5 text-[14px]"
                  >
                    {mode === "jobs" ? "Reviewed" : "Candidates"}{" "}
                    {stats.reviewed}
                  </Badge>
                ) : null}
                {stats.removed != null ? (
                  <Badge
                    variant="secondary"
                    className="tabular h-9 px-3.5 text-[14px]"
                  >
                    Removed {stats.removed}
                  </Badge>
                ) : null}
                {stats.promising != null ? (
                  <Badge
                    variant="default"
                    className="tabular h-9 px-3.5 text-[14px]"
                  >
                    Promising {stats.promising}
                  </Badge>
                ) : null}
                {stats.regionOrCategory ? (
                  <Badge
                    variant="ghost"
                    className="h-auto max-w-full whitespace-normal px-3.5 py-1.5 text-center text-[14px] leading-snug"
                  >
                    {stats.regionOrCategory}
                  </Badge>
                ) : null}
              </div>

              {resolving && resultSummary ? (
                <div
                  className={cn(
                    "search-result-banner mt-10 rounded-2xl border px-6 py-5 text-left",
                    resultSummary.empty
                      ? "border-border bg-muted/40"
                      : "border-primary/30 bg-primary/10",
                  )}
                >
                  <p className="font-display text-[20px] font-semibold tracking-tight text-[var(--card-foreground)]">
                    {resultSummary.title}
                  </p>
                  {resultSummary.detail ? (
                    <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                      {resultSummary.detail}
                    </p>
                  ) : null}
                  {(resultSummary.strong != null ||
                    resultSummary.secondary != null) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {resultSummary.strong != null ? (
                        <Badge variant="default" className="tabular h-8 px-3">
                          {resultSummary.strong} strong
                        </Badge>
                      ) : null}
                      {resultSummary.secondary != null ? (
                        <Badge variant="outline" className="tabular h-8 px-3">
                          {resultSummary.secondary} worth a look
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Mobile stage dots */}
            <nav
              className="mt-10 flex items-center justify-center gap-2 lg:hidden"
              aria-label="Search stages"
            >
              {SEARCH_UX_STAGES.map((stage, index) => {
                const done = index < activeIdx || resolving;
                const current = index === activeIdx && !resolving;
                return (
                  <span
                    key={stage.id}
                    title={stage.label}
                    className={cn(
                      "size-2 rounded-full transition-all duration-500",
                      done && "bg-primary",
                      current && "bg-primary scale-150 ring-primary/40 ring-3",
                      !done && !current && "bg-muted-foreground/25",
                    )}
                  />
                );
              })}
            </nav>
          </div>
        </div>

        {/* Progress foot — Artlist / Employment Hero */}
        <footer className="border-border/60 shrink-0 border-t px-5 py-5 sm:px-10 sm:py-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-end sm:gap-8">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-[13px]">
                  {resolving
                    ? "Finishing up"
                    : "Stay on this page until results are ready"}
                </p>
                <p className="font-display tabular text-primary text-[28px] leading-none font-semibold sm:hidden">
                  {percent != null ? `${percent}%` : "…"}
                </p>
              </div>
              <div
                className="bg-muted/80 relative h-3 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent ?? undefined}
                aria-label="Search progress"
              >
                {percent != null ? (
                  <span
                    className="search-progress-fill absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="job-search-bar absolute inset-y-0 w-1/3 rounded-full bg-primary"
                  />
                )}
              </div>
            </div>
            <p className="font-display tabular text-primary hidden text-[40px] leading-none font-semibold sm:block">
              {percent != null ? `${percent}%` : "…"}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Square / Etsy progress ring — determinate fill from percent,
 * indeterminate rotating arc while waiting (Brilliant / Square).
 */
function StageProgressRing({
  percent,
  resolving,
  children,
}: {
  percent: number | null;
  resolving: boolean;
  children: ReactNode;
}) {
  const size = 200;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const indeterminate = percent == null && !resolving;
  const clamped =
    percent == null ? (resolving ? 100 : 0) : Math.max(0, Math.min(100, percent));
  const dashOffset = indeterminate
    ? circumference * 0.72
    : circumference - (circumference * clamped) / 100;

  return (
    <div
      className="stage-progress-ring relative mx-auto"
      style={{ width: size, height: size }}
    >
      <svg
        className="pointer-events-none absolute inset-0"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border/50"
        />
        <g
          className={cn(
            "origin-center",
            indeterminate && "stage-progress-spin",
          )}
          style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="stage-progress-arc stroke-primary"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: `${size / 2}px ${size / 2}px`,
              transition: indeterminate
                ? undefined
                : "stroke-dashoffset 500ms var(--ease-out-soft)",
            }}
          />
        </g>
      </svg>
      <div className="relative flex h-full items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/** Exit → swap → enter; all setState happens inside timeouts (lint-safe). */
function useSpotlightChoreography(
  targetStageId: SearchUxStageId,
  targetDetail: string,
): SpotlightFrame {
  const [frame, setFrame] = useState<SpotlightFrame>(() => ({
    stageId: targetStageId,
    detail: targetDetail,
    phase: "enter",
  }));

  const frameRef = useRef(frame);
  const targetRef = useRef({ stageId: targetStageId, detail: targetDetail });

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    targetRef.current = { stageId: targetStageId, detail: targetDetail };
  }, [targetStageId, targetDetail]);

  // Initial enter → idle
  useEffect(() => {
    const id = window.setTimeout(() => {
      setFrame((f) => (f.phase === "enter" ? { ...f, phase: "idle" } : f));
    }, 520);
    return () => window.clearTimeout(id);
  }, []);

  // Stage changes
  useEffect(() => {
    const current = frameRef.current;
    if (targetStageId === current.stageId) {
      if (current.phase === "idle" && current.detail !== targetDetail) {
        const id = window.setTimeout(() => {
          setFrame((f) =>
            f.stageId === targetStageId && f.phase === "idle"
              ? { ...f, detail: targetDetail }
              : f,
          );
        }, 0);
        return () => window.clearTimeout(id);
      }
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      const id = window.setTimeout(() => {
        setFrame({
          stageId: targetStageId,
          detail: targetDetail,
          phase: "idle",
        });
      }, 0);
      return () => window.clearTimeout(id);
    }

    let cancelled = false;
    const exitId = window.setTimeout(() => {
      if (cancelled) return;
      setFrame((f) => ({ ...f, phase: "exit" }));
    }, 0);

    const swapId = window.setTimeout(() => {
      if (cancelled) return;
      const next = targetRef.current;
      setFrame({
        stageId: next.stageId,
        detail: next.detail,
        phase: "enter",
      });
    }, 320);

    const idleId = window.setTimeout(() => {
      if (cancelled) return;
      setFrame((f) => (f.phase === "enter" ? { ...f, phase: "idle" } : f));
    }, 320 + 520);

    return () => {
      cancelled = true;
      window.clearTimeout(exitId);
      window.clearTimeout(swapId);
      window.clearTimeout(idleId);
    };
  }, [targetStageId, targetDetail]);

  return frame;
}

/** @deprecated Use SearchExperience */
export { SearchExperience as SearchProgressModal };
