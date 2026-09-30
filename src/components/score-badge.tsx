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
    body: `Weighted fit across skills, seniority, location, and preferences (computed in app — not a model guess). ${STRONG_MATCH_MIN}%+ Strong · ${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1}% Worth a look.`,
  },
  fit: {
    title: "Fit score",
    body: "Percent fit for outreach — need, timing, and your positioning. Not a job match score.",
  },
};

function matchLabel(
  score: number,
  tier: "strong" | "worth_a_look" | null,
): string {
  if (tier === "strong") return score >= 80 ? "Great match" : "Strong match";
  if (tier === "worth_a_look") return "Worth a look";
  return "Low match";
}

function formatScore(score: number): string {
  const n = Number.isInteger(score) ? String(score) : score.toFixed(1);
  return `${n}%`;
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
      <p className="font-medium text-foreground">{title}</p>
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

  const display = formatScore(score);
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
                "inline-flex min-w-[3.75rem] cursor-help flex-col items-end justify-center gap-0.5 rounded-2xl px-3 py-2 transition-[transform,background-color] duration-150 ease-standard hover:scale-[1.02] sm:items-center",
                size === "sm" && "min-w-[3.25rem] px-2.5 py-1.5",
                strong
                  ? "bg-brand/15 text-brand-ink"
                  : "bg-muted text-muted-foreground",
                className,
              )}
              aria-label={`Fit score ${display}`}
              onClick={onClick}
            />
          }
        >
          <span
            className={cn(
              "font-mono tabular leading-none font-medium tracking-tight",
              size === "sm" ? "text-[18px]" : "text-[22px]",
            )}
          >
            {display}
          </span>
          <span className="text-[11px] font-medium tracking-wide uppercase opacity-80">
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
              "inline-flex min-w-[4.5rem] cursor-help flex-col items-end justify-center gap-1 rounded-2xl px-3 py-2 text-right transition-[transform,background-color] duration-150 ease-standard hover:scale-[1.02] sm:items-center sm:text-center",
              size === "sm" && "min-w-[4rem] gap-0.5 px-2.5 py-1.5",
              tier === "strong" && "bg-brand/15 text-brand-ink",
              tier === "worth_a_look" &&
                "bg-amber-500/12 text-amber-100",
              !tier && "bg-muted text-muted-foreground",
              className,
            )}
            aria-label={`${label}, ${display}`}
            onClick={onClick}
          />
        }
      >
        <span
          className={cn(
            "font-mono tabular leading-none font-medium tracking-tight",
            size === "sm" ? "text-[20px]" : "text-[24px]",
          )}
        >
          {display}
        </span>
        <span
          className={cn(
            "max-w-[6.5rem] font-medium leading-tight tracking-wide",
            size === "sm" ? "text-[11px]" : "text-[12px]",
            tier === "strong" && "text-brand-ink/85",
            tier === "worth_a_look" && "text-amber-100/85",
            !tier && "text-muted-foreground",
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
