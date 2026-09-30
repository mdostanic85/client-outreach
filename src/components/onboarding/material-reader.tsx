"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Beat = { chip: string; line: string };

type Stage = {
  id: string;
  label: string;
  /** Share of the wait this stage occupies, before the curve caps. */
  until: number;
  beats: Beat[];
};

const CV_BEATS: Beat[] = [
  { chip: "Roles", line: "Looking at the roles you've held" },
  { chip: "Skills", line: "Noting the tools and skills you list" },
  { chip: "Dates", line: "Checking how long you stayed in each job" },
];

const SITE_BEATS: Beat[] = [
  { chip: "Pages", line: "Opening the pages on your site" },
  { chip: "Projects", line: "Reading the projects you show" },
  { chip: "About", line: "Noting how you describe your work" },
];

const PROFILE_BEATS: Beat[] = [
  { chip: "Profile", line: "Building one profile from all of this" },
  { chip: "Evidence", line: "Keeping only what's in your material" },
  { chip: "Fit", line: "Lining it up with the job you want" },
];

const SCORE_BEATS: Beat[] = [
  { chip: "Clarity", line: "Scoring how clear the CV is" },
  { chip: "Proof", line: "Looking for claims without proof" },
  { chip: "Fixes", line: "Writing what to fix first" },
];

function stagesFor(hasWebsite: boolean): Stage[] {
  if (hasWebsite) {
    return [
      { id: "cv", label: "CV", until: 0.28, beats: CV_BEATS },
      { id: "site", label: "Site", until: 0.48, beats: SITE_BEATS },
      { id: "profile", label: "Profile", until: 0.72, beats: PROFILE_BEATS },
      { id: "score", label: "Score", until: 1, beats: SCORE_BEATS },
    ];
  }
  return [
    { id: "cv", label: "CV", until: 0.36, beats: CV_BEATS },
    { id: "profile", label: "Profile", until: 0.68, beats: PROFILE_BEATS },
    { id: "score", label: "Score", until: 1, beats: SCORE_BEATS },
  ];
}

/** Approaches ~96% and keeps creeping, so the ring never looks stuck. */
function percentFromElapsed(ms: number): number {
  return Math.min(96, 96 * (1 - Math.exp(-ms / 22000)));
}

const ROW_WIDTHS = ["72%", "46%", "88%", "64%", "92%", "54%", "78%"];

/**
 * Same choreography as job search — stage rail, a live centre, one sentence —
 * with a page being read instead of a radar.
 */
export function MaterialReader({ hasWebsite }: { hasWebsite: boolean }) {
  const stages = stagesFor(hasWebsite);
  const [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const percent = percentFromElapsed(elapsed);
  const fraction = percent / 96;
  const found = stages.findIndex((stage) => fraction < stage.until);
  const stageIndex = found === -1 ? stages.length - 1 : found;
  const stage = stages[stageIndex] ?? stages[0]!;
  const previous = stages[stageIndex - 1]?.until ?? 0;
  const local = Math.max(0, Math.min(1, (fraction - previous) / (stage.until - previous)));
  const beat = stage.beats[Math.floor(elapsed / 2600) % stage.beats.length] ?? stage.beats[0]!;

  return (
    <div className="flex flex-col items-center gap-8">
      <ol
        aria-label="Reading stages"
        className="grid w-full gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
      >
        {stages.map((item, index) => {
          const done = index < stageIndex;
          const current = index === stageIndex;
          return (
            <li
              key={item.id}
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
                {current ? (
                  <span
                    className="search-progress-fill block h-full"
                    style={{ width: `${Math.max(8, local * 100)}%` }}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "flex max-w-full items-center gap-1.5 text-[13px] sm:text-[15px]",
                  current && "text-foreground font-medium",
                  done && "text-muted-foreground",
                  !done && !current && "text-muted-foreground/45",
                )}
              >
                {done ? (
                  <Check className="text-brand-ink size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                ) : (
                  <span className="tabular shrink-0 text-[12px] opacity-70 max-sm:hidden">{index + 1}</span>
                )}
                <span className="truncate">{item.label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="material-sheet relative w-full overflow-hidden rounded-[1.35rem] px-6 pt-7 pb-5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={`${stage.label}. ${beat.line}`}
        aria-label="Reading your material"
      >
        <div className="material-scan pointer-events-none absolute inset-x-0 top-0 h-28" aria-hidden />
        <div className="relative flex flex-col gap-3">
          <span className="bg-foreground/80 h-2.5 w-[46%] rounded-full" />
          <span className="bg-foreground/35 mb-2 h-2 w-[28%] rounded-full" />
          {ROW_WIDTHS.map((width, index) => (
            <span
              key={width}
              className={cn(
                "h-2 rounded-full",
                reduced ? "bg-foreground/15" : "material-row-live",
              )}
              style={{
                width,
                animationDelay: reduced ? undefined : `${index * 0.32}s`,
              }}
            />
          ))}
        </div>
        <div className="relative mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
          <p className="tabular text-[2.6rem] leading-none font-medium tracking-tight text-foreground">
            {Math.round(percent)}
            <span className="text-muted-foreground text-[1.2rem] font-medium">%</span>
          </p>
          <p
            key={beat.chip}
            className="search-activity-line text-brand-ink pb-1 text-[12px] font-medium tracking-[0.14em] uppercase"
          >
            {beat.chip}
          </p>
        </div>
      </div>

      <p
        key={`${stage.id}-${beat.chip}`}
        className="search-activity-line text-muted-foreground h-12 max-w-sm text-center text-[16px] leading-relaxed sm:text-[17px]"
        aria-live="polite"
      >
        {beat.line}
      </p>
    </div>
  );
}
