"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobSearchStepId } from "@/modules/jobs/progress";

const JOB_STEPS = [
  { id: "collect" as const, label: "Scanning job boards" },
  { id: "filter" as const, label: "Filtering by your criteria" },
  { id: "evaluate" as const, label: "Scoring strong matches" },
  { id: "publish" as const, label: "Building today’s list" },
];

const COMPANY_STEPS = [
  { id: "discover", label: "Scanning company sources" },
  { id: "research", label: "Researching fit signals" },
  { id: "score", label: "Scoring outreach targets" },
  { id: "publish", label: "Building today’s list" },
] as const;

const STEP_MS = 4500;

export type SearchProgressMode = "jobs" | "companies";

export type LiveSearchProgress = {
  percent: number;
  stepId: JobSearchStepId | string;
  detail?: string;
};

type SearchProgressModalProps = {
  open: boolean;
  mode: SearchProgressMode;
  onCancel: () => void;
  /** When set, drives real progress instead of the timer fallback. */
  live?: LiveSearchProgress | null;
};

/**
 * Cancelable search overlay.
 * Patterns: Teachable circular progress + Cancel, GoDaddy centered modal,
 * Relevance AI step checklist, Qatalog Esc cancel — via Mobbin.
 */
export function SearchProgressModal({
  open,
  mode,
  onCancel,
  live = null,
}: SearchProgressModalProps) {
  const titleId = useId();
  const steps = mode === "jobs" ? JOB_STEPS : COMPANY_STEPS;
  const [activeStep, setActiveStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      return;
    }
    if (live) return;
    const id = window.setInterval(() => {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [open, steps.length, live]);

  useEffect(() => {
    if (!open || !live) return;
    const idx = steps.findIndex((s) => s.id === live.stepId);
    if (idx >= 0) setActiveStep(idx);
  }, [open, live, steps]);

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

  if (!open || !mounted) return null;

  const progress = live
    ? Math.max(0, Math.min(100, Math.round(live.percent)))
    : Math.round(((activeStep + 1) / steps.length) * 100);
  const headline =
    live && progress >= 100
      ? "Done"
      : activeStep >= steps.length - 1 && !live
        ? "Almost ready…"
        : mode === "jobs"
          ? "Searching for jobs…"
          : "Finding companies…";
  const detail =
    live?.detail ??
    (mode === "jobs"
      ? "Collecting openings, then keeping only the strong fits."
      : "Discovering companies, then ranking outreach targets.");
  const Icon = mode === "jobs" ? Search : Building2;

  return createPortal(
    <div
      className="animate-in fade-in duration-200 fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <div
        className="bg-background/70 absolute inset-0 backdrop-blur-[2px]"
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy="true"
        className={cn(
          "border-border bg-card relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-[20px] border shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)]",
          "animate-in zoom-in-95 fade-in duration-200",
        )}
      >
        <div className="flex flex-col items-center gap-6 px-6 pt-8 pb-6 text-center sm:px-8">
          <div className="relative grid size-28 place-items-center">
            <span
              aria-hidden
              className="job-search-ring absolute inset-0 rounded-full border-2 border-primary/30"
              style={{ animationDelay: "0ms" }}
            />
            <span
              aria-hidden
              className="job-search-ring absolute inset-[-10px] rounded-full border border-primary/16"
              style={{ animationDelay: "350ms" }}
            />
            <svg
              className="search-progress-circle absolute inset-1 size-[calc(100%-8px)] -rotate-90"
              viewBox="0 0 100 100"
              aria-hidden
            >
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                className="stroke-muted"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
              />
            </svg>
            <div className="bg-accent text-accent-foreground relative grid size-14 place-items-center rounded-2xl border border-primary/30 shadow-[0_0_36px_-8px_var(--primary)]">
              <Icon className="size-6 animate-pulse" strokeWidth={1.75} />
            </div>
          </div>

          <div className="space-y-2">
            <p
              id={titleId}
              className="font-display text-[22px] font-semibold tracking-tight text-[var(--card-foreground)]"
            >
              {headline}
            </p>
            <p
              className="text-muted-foreground min-h-[2.5rem] text-[15px] leading-relaxed"
              aria-live="polite"
            >
              {detail}
            </p>
            <p className="tabular text-primary text-[14px] font-medium">
              {progress}%
            </p>
          </div>

          <div
            className="bg-muted/50 relative h-1.5 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Search progress"
          >
            {live ? (
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            ) : (
              <span
                aria-hidden
                className="job-search-bar absolute inset-y-0 w-1/3 rounded-full bg-primary"
              />
            )}
          </div>

          <ol className="w-full space-y-2.5 text-left">
            {steps.map((step, index) => {
              const done = index < activeStep;
              const current = index === activeStep;
              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 text-[15px] transition-colors duration-300",
                    done && "text-primary",
                    current && "text-[var(--card-foreground)]",
                    !done && !current && "text-muted-foreground/55",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border text-[13px] font-medium transition-all duration-300",
                      done &&
                        "border-primary/40 bg-primary text-primary-foreground",
                      current &&
                        "border-primary/50 bg-accent text-accent-foreground ring-2 ring-primary/25",
                      !done &&
                        !current &&
                        "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={2.5} />
                    ) : current ? (
                      <span
                        aria-hidden
                        className="size-1.5 animate-pulse rounded-full bg-primary"
                      />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className={cn(current && "font-medium")}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="border-border flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
          <p className="text-muted-foreground text-[13px]">
            Esc to stop waiting
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
