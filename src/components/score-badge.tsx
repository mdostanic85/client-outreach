"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { badgeVariants } from "@/components/ui/badge";
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

const ESTIMATE_TOOLTIP_TITLE = "Quick estimate";

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

/**
 * The one score pattern: a pill in the badge family. Tone follows the tier
 * (strong → verdigris, worth a look → warn, low → neutral); the number is
 * tabular so lists line up.
 */
export function ScoreBadge({
  score,
  kind = "match",
  size = "md",
  className,
  tooltip,
  estimated = false,
  onClick,
}: {
  score: number | null;
  kind?: ScoreKind;
  /** The number is a quick estimate from title, skills and place, not an AI evaluation. */
  estimated?: boolean;
  size?: "sm" | "md";
  className?: string;
  tooltip?: string;
  onClick?: () => void;
}) {
  if (score == null) {
    return (
      <span className="text-muted-foreground tabular text-body-sm" aria-hidden>
        —
      </span>
    );
  }

  const display = estimated ? `~${formatScore(score)}` : formatScore(score);
  const tip = estimated ? { title: ESTIMATE_TOOLTIP_TITLE, body: "" } : TOOLTIPS[kind];
  const tipBody =
    tooltip ??
    (estimated
      ? "Not scored by the AI yet. Based on how well the title, skills and place fit your search. Open the job to score it properly."
      : tip.body);

  let tone: "brand" | "warn" | "secondary";
  let label: string;
  if (estimated) {
    tone = "secondary";
    label = "Estimate";
  } else if (kind === "fit") {
    tone = score >= 70 ? "brand" : "secondary";
    label = "fit";
  } else {
    const tier = matchTierForScore(score);
    tone = tier === "strong" ? "brand" : tier === "worth_a_look" ? "warn" : "secondary";
    label = matchLabel(score, tier);
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              badgeVariants({ variant: tone }),
              "cursor-help gap-1.5",
              size === "md" ? "h-8 px-3 text-body-sm" : "h-7 px-2.5",
              className,
            )}
            aria-label={kind === "fit" ? `Fit score ${display}` : `${label}, ${display}`}
            onClick={onClick}
          />
        }
      >
        <span className="tabular font-medium">{display}</span>
        <span className="font-normal">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8} className="max-w-[240px]">
        <ScoreTooltipBody title={tip.title} body={tipBody} />
      </TooltipContent>
    </Tooltip>
  );
}
