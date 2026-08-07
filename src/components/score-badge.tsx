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

const TOOLTIPS: Record<ScoreKind, { title: string; body: string }> = {
  match: {
    title: "Match score",
    body: `How closely this role fits your approved profile — skills, seniority, location, and preferences. ${STRONG_MATCH_MIN}+ Strong · ${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1} Worth a look.`,
  },
  fit: {
    title: "Fit score",
    body: "How well this company fits outreach — need, timing, and your positioning. Not a job match score.",
  },
};

function matchLabel(
  score: number,
  tier: "strong" | "worth_a_look" | null,
): string {
  if (tier === "strong") return score >= 80 ? "Great match" : "Strong match";
  if (tier === "worth_a_look") return "Worth a look";
  return "Match";
}

function ScoreTooltipBody({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-1 text-left">
      <p className="font-medium text-[var(--card-foreground)]">{title}</p>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}

export function ScoreBadge({
  score,
  kind = "match",
  size = "md",
  className,
  tooltip,
  onClick,
}: {
  score: number | null;
  kind?: ScoreKind;
  size?: "sm" | "md";
  className?: string;
  tooltip?: string;
  onClick?: () => void;
}) {
  if (score == null) {
    return (
      <span className="text-muted-foreground tabular text-[15px]" aria-hidden>
        —
      </span>
    );
  }

  const display = Number.isInteger(score) ? score : Number(score.toFixed(1));
  const tip = TOOLTIPS[kind];
  const tipBody = tooltip ?? tip.body;

  if (kind === "fit") {
    const strong = score >= 70;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className={cn(
                "inline-flex min-w-[4.25rem] cursor-help flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 font-semibold tabular-nums transition-[transform,box-shadow,background-color] duration-150 ease-[var(--ease-out-soft)] hover:scale-[1.03]",
                size === "sm" && "min-w-[3.5rem] px-2.5 py-1.5",
                strong
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted text-muted-foreground ring-1 ring-border",
                className,
              )}
              aria-label={`Fit score ${display}`}
              onClick={onClick}
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
        <TooltipContent side="left" sideOffset={8} className="max-w-[240px]">
          <ScoreTooltipBody title={tip.title} body={tipBody} />
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
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 cursor-help items-center justify-center gap-3 rounded-[24px] px-3.5 py-2.5 transition-[transform,box-shadow,background-color] duration-150 ease-[var(--ease-out-soft)] hover:scale-[1.03]",
              size === "sm" && "gap-2 px-3 py-2",
              tier === "strong" && "bg-primary/15 text-primary",
              tier === "worth_a_look" &&
                "bg-amber-500/12 text-amber-900 dark:text-amber-100",
              !tier && "bg-muted text-muted-foreground",
              className,
            )}
            aria-label={`${label}, score ${display}`}
            onClick={onClick}
          />
        }
      >
        <span
          className={cn(
            "font-mono tabular font-semibold leading-none tracking-tight",
            size === "sm" ? "text-[22px]" : "text-[28px]",
          )}
        >
          {display}
        </span>
        <span
          className={cn(
            "font-medium leading-tight tracking-wide whitespace-nowrap",
            size === "sm" ? "text-[13px]" : "text-[15px]",
          )}
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8} className="max-w-[240px]">
        <ScoreTooltipBody title={tip.title} body={tipBody} />
      </TooltipContent>
    </Tooltip>
  );
}
