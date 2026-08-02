"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  STRONG_MATCH_MIN,
  WORTH_A_LOOK_MIN,
  matchTierForScore,
} from "@/modules/matching/tiers";

type ScoreKind = "match" | "fit";

const TOOLTIPS: Record<ScoreKind, string> = {
  match:
    "How closely this role matches your approved profile — skills, seniority, location, and preferences. 70+ is Strong; 55–69 is Worth a look.",
  fit: "How well this company fits outreach — need, timing, and your positioning. Not a job match score.",
};

function matchLabel(
  score: number,
  tier: "strong" | "worth_a_look" | null,
): string {
  if (tier === "strong") return score >= 80 ? "Great match" : "Strong match";
  if (tier === "worth_a_look") return "Worth a look";
  return "Match";
}

export function ScoreBadge({
  score,
  kind = "match",
  size = "md",
  className,
  tooltip,
}: {
  score: number | null;
  kind?: ScoreKind;
  size?: "sm" | "md";
  className?: string;
  tooltip?: string;
}) {
  if (score == null) {
    return (
      <span className="text-muted-foreground tabular text-[15px]" aria-hidden>
        —
      </span>
    );
  }

  const display = Number.isInteger(score) ? score : Number(score.toFixed(1));
  const tip = tooltip ?? TOOLTIPS[kind];

  if (kind === "fit") {
    const strong = score >= 70;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn(
                "inline-flex min-w-[4.25rem] cursor-help flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 font-semibold tabular-nums transition-[transform,box-shadow,background-color] duration-150 ease-[var(--ease-out-soft)] hover:scale-[1.03]",
                size === "sm" && "min-w-[3.5rem] px-2.5 py-1.5",
                strong
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted text-muted-foreground ring-1 ring-border",
                className,
              )}
              aria-label={`Fit score ${display}`}
            />
          }
        >
          <span
            className={cn(
              "font-display leading-none tracking-tight",
              size === "sm" ? "text-[20px]" : "text-[24px]",
            )}
          >
            {display}
          </span>
          <span className="text-[13px] font-medium tracking-wide uppercase opacity-80">
            Fit
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left leading-relaxed">
          {tip}
        </TooltipContent>
      </Tooltip>
    );
  }

  const tier = matchTierForScore(score);
  const label = matchLabel(score, tier);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "flex shrink-0 cursor-help flex-col items-center justify-center gap-1 rounded-2xl px-3.5 py-2.5 min-w-[6.75rem] transition-[transform,box-shadow,background-color] duration-150 ease-[var(--ease-out-soft)] hover:scale-[1.03]",
              size === "sm" && "min-w-[5rem] gap-0.5 px-3 py-2",
              tier === "strong" &&
                "bg-primary/15 text-primary ring-1 ring-primary/30",
              tier === "worth_a_look" &&
                "bg-amber-500/12 text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-100",
              !tier && "bg-muted text-muted-foreground ring-1 ring-border",
              className,
            )}
            aria-label={`${label}, score ${display}`}
          />
        }
      >
        <span
          className={cn(
            "font-display tabular font-semibold leading-none tracking-tight",
            size === "sm" ? "text-[22px]" : "text-[28px]",
          )}
        >
          {display}
        </span>
        <span
          className={cn(
            "font-medium leading-tight tracking-wide",
            size === "sm" ? "text-[12px]" : "text-[15px]",
          )}
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-relaxed">
        {tip}
        {` (${STRONG_MATCH_MIN}+ Strong · ${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1} Worth a look)`}
      </TooltipContent>
    </Tooltip>
  );
}
