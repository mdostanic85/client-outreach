"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchRadar, type RadarActivity } from "@/components/search-radar";
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
  /** Newest first. */
  activity?: RadarActivity[];
};

export type SearchResultSummary = {
  title: string;
  detail?: string;
};

type SearchExperienceProps = {
  open: boolean;
  mode: SearchExperienceMode;
  onCancel: () => void;
  /** Keep the run going and collapse it into the topbar. Escape minimizes when set. */
  onMinimize?: () => void;
  live?: LiveSearchProgress | null;
  resultSummary?: SearchResultSummary | null;
  slow?: boolean;
};

type SpotlightFrame = {
  stageId: SearchUxStageId;
  detail: string;
  phase: "enter" | "idle" | "exit";
};

/** Immersive search UI: stage rail, live radar, and activity feed. */
export function SearchExperience({
  open,
  mode,
  onCancel,
  onMinimize,
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
        // A stray Escape must not throw away a multi-minute run.
        (onMinimize ?? onCancel)();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onMinimize]);

  if (!open || typeof document === "undefined") return null;

  // Unmount when closed so each open starts a fresh stage choreography.
  return createPortal(
    <SearchExperienceInner
      titleId={titleId}
      mode={mode}
      onCancel={onCancel}
      onMinimize={onMinimize}
      live={live}
      resultSummary={resultSummary}
      slow={slow}
    />,
    document.body,
  );
}

const STEP_SHORT: Record<SearchUxStageId, string> = {
  search_sources: "Sources",
  filter: "Filter",
  score: "Score",
  prepare: "Shortlist",
};

/** One activity line at a time. A new event shows immediately, then the line keeps moving. */
function useRotatingActivity(activity: RadarActivity[], paused: boolean) {
  const [index, setIndex] = useState(0);
  const newestId = activity[0]?.id ?? null;

  useEffect(() => {
    setIndex(0);
  }, [newestId]);

  useEffect(() => {
    if (paused || activity.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % activity.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [paused, activity.length, newestId]);

  if (activity.length === 0) return null;
  return activity[index % activity.length] ?? activity[0] ?? null;
}

function SearchExperienceInner({
  titleId,
  mode,
  onCancel,
  onMinimize,
  live,
  resultSummary,
  slow,
}: {
  titleId: string;
  mode: SearchExperienceMode;
  onCancel: () => void;
  onMinimize?: () => void;
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
    return mode === "jobs" ? uxStageFromJobStep(stepId) : uxStageFromCompanyStep(stepId);
  }, [live?.stepId, mode, resolving]);

  const targetDetail = resolving
    ? (resultSummary?.detail ?? "Preparing your shortlist…")
    : (live?.detail ??
      (mode === "jobs"
        ? SEARCH_UX_STAGES.find((s) => s.id === targetStageId)?.jobsHint
        : SEARCH_UX_STAGES.find((s) => s.id === targetStageId)?.companiesHint) ??
      "Working…");

  const frame = useSpotlightChoreography(targetStageId, targetDetail);
  const activeIdx = stageIndex(frame.stageId);
  const currentStage = SEARCH_UX_STAGES[activeIdx] ?? SEARCH_UX_STAGES[0];
  const activity = live?.activity ?? [];
  const [hoverId, setHoverId] = useState<number | null>(null);
  const rotating = useRotatingActivity(activity, hoverId != null);
  const activeId = hoverId ?? rotating?.id ?? null;
  const shown = activity.find((item) => item.id === activeId) ?? null;

  const liveDetail = frame.phase === "exit" ? frame.detail : targetDetail;
  const statusLine = resolving
    ? (resultSummary?.title ?? "Ready")
    : shown
      ? null
      : liveDetail;

  return (
    <div
      className="animate-in fade-in duration-300 fixed inset-0 z-50 flex flex-col"
      role="presentation"
    >
      <div className="bg-background absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden />

      {!resolving ? (
        <div className="absolute top-0 right-0 z-20 flex items-center gap-2 p-5 sm:p-8">
          {onMinimize ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onMinimize}
              className="gap-1.5"
            >
              <Minimize2 className="size-3.5" strokeWidth={2} />
              Keep browsing
            </Button>
          ) : null}
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
        </div>
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={!resolving}
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <h2 id={titleId} className="sr-only">
          {resolving
            ? (resultSummary?.title ?? "Search finished")
            : `${mode === "jobs" ? "Finding jobs" : "Finding companies"}, ${currentStage.label}`}
        </h2>

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 pt-20 pb-10 sm:gap-16 sm:px-10 sm:py-20">
          {/* Four equal columns: never wraps, so no step ends up alone on its own line. */}
          <ol aria-label="Search stages" className="grid w-full max-w-xl grid-cols-4 gap-2 sm:gap-3">
            {SEARCH_UX_STAGES.map((stage, index) => {
              const done = index < activeIdx || resolving;
              const current = index === activeIdx && !resolving;
              return (
                <li
                  key={stage.id}
                  aria-current={current ? "step" : undefined}
                  className="flex min-w-0 flex-col items-center gap-2.5"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1 w-full overflow-hidden rounded-full",
                      done ? "bg-brand/45" : "bg-muted-foreground/20",
                    )}
                  >
                    {current ? <span className="search-progress-fill block h-full w-full" /> : null}
                  </span>
                  <span
                    className={cn(
                      "flex max-w-full items-center gap-1.5 text-body-sm sm:text-body",
                      current && "text-foreground font-medium",
                      done && "text-muted-foreground",
                      !done && !current && "text-muted-foreground/45",
                    )}
                  >
                    {done ? (
                      <Check className="text-brand-ink size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <span className="tabular shrink-0 text-caption opacity-70 max-sm:hidden">{index + 1}</span>
                    )}
                    <span className="truncate">{STEP_SHORT[stage.id]}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <StageProgressRing percent={resolving ? 100 : percent} resolving={resolving}>
            {resolving ? (
              <Check
                className="text-brand-ink stage-spotlight-check size-16 sm:size-20"
                strokeWidth={2}
                aria-hidden
              />
            ) : (
              <SearchRadar
                activity={activity}
                activeId={activeId}
                onActiveChange={setHoverId}
                value={percent != null ? `${percent}%` : "…"}
              />
            )}
          </StageProgressRing>

          <div className="flex h-12 w-full max-w-lg items-center justify-center px-2" aria-live="polite">
            {shown && !resolving ? (
              <p
                key={shown.id}
                className="search-activity-line flex max-w-full items-baseline justify-center gap-2 text-center text-body sm:text-body-lg"
              >
                <span className="truncate text-foreground">{shown.label}</span>
                {shown.meta ? (
                  <span className="text-muted-foreground truncate">{shown.meta}</span>
                ) : null}
                {shown.value ? (
                  <span className="tabular text-brand-ink shrink-0 text-body-sm">
                    {shown.value}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-muted-foreground max-w-md text-center text-body leading-relaxed sm:text-body-lg">
                {slow && !resolving ? "Taking longer than usual" : statusLine}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Determinate fill from percent; indeterminate rotating arc while waiting.
 */
function useRadarSize() {
  const [size, setSize] = useState(440);
  useEffect(() => {
    const measure = () => {
      // Phones use the full width minus the page gutter; wider screens keep breathing room.
      const width = window.innerWidth < 640 ? window.innerWidth - 48 : window.innerWidth * 0.72;
      const next = Math.min(540, width, window.innerHeight * 0.5);
      setSize(Math.max(200, Math.round(next)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return size;
}

function StageProgressRing({
  percent,
  resolving,
  children,
}: {
  percent: number | null;
  resolving: boolean;
  children: ReactNode;
}) {
  const size = useRadarSize();
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
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-label="Search progress"
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
            className="stage-progress-arc stroke-brand"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: `${size / 2}px ${size / 2}px`,
              transition: indeterminate
                ? undefined
                : "stroke-dashoffset 500ms var(--ease-standard)",
            }}
          />
        </g>
      </svg>
      <div className="absolute inset-[8%] grid place-items-center">
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
