import Link from "next/link";
import { ScoreBadge } from "@/components/score-badge";
import { StatePill } from "@/components/status-pill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { labelPolicy } from "@/lib/ui-labels";
import type { LeadDetail } from "./lead-stage";

const SCORE_DIMENSION_TOOLTIPS: Record<string, string> = {
  needNow: "Evidence the company is hiring or actively needing help soon.",
  fit: "How well your positioning matches this company's need.",
  abilityToPay: "Signals they can afford help.",
  accessibility: "How reachable the right contact looks.",
  engagementMatch: "Alignment with how you prefer to engage.",
};

const SCORE_DIMENSION_LABELS: Record<string, string> = {
  needNow: "Need now",
  fit: "Fit",
  abilityToPay: "Ability to pay",
  accessibility: "Accessibility",
  engagementMatch: "Engagement match",
};

/** Company name, state, policy and the fit score with its breakdown. */
export function LeadHeader({ detail }: { detail: LeadDetail }) {
  const breakdown = detail.lead.scoreBreakdownJson
    ? (JSON.parse(detail.lead.scoreBreakdownJson) as Record<string, number>)
    : null;

  return (
    <>
      <header className="border-border flex flex-wrap items-start justify-between gap-6 border-b pb-8">
        <div className="min-w-0 max-w-3xl space-y-4">
          <nav className="text-muted-foreground text-body-sm font-medium">
            <Link
              href="/"
              className="hover:text-foreground transition-colors"
            >
              Today · Companies
            </Link>
            <span> / {detail.company.name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-h4 leading-[1.15] font-medium text-balance text-foreground">
              {detail.company.name}
            </h1>
            <StatePill state={detail.lead.state} />
          </div>
          <p className="text-muted-foreground text-body">
            {[detail.company.domain ?? "No domain", detail.company.country]
              .filter(Boolean)
              .join(" · ")}
            {" · "}
            research {detail.lead.researchStatus}
          </p>
          <p className="text-muted-foreground text-body">
            {labelPolicy(detail.policy.policy)}
            {detail.policy.code ? ` · ${detail.policy.code}` : ""}
            {detail.lead.recommendedContactRole
              ? ` · Role: ${detail.lead.recommendedContactRole}`
              : ""}
            {detail.lead.recommendedAngle
              ? ` · Angle: ${detail.lead.recommendedAngle}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 pt-1">
          <ScoreBadge score={detail.lead.score} kind="fit" />
        </div>
      </header>

      {breakdown ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 text-body">
          {(
            [
              "needNow",
              "fit",
              "abilityToPay",
              "accessibility",
              "engagementMatch",
            ] as const
          ).map((k) => (
            <Tooltip key={k}>
              <TooltipTrigger
                render={
                  <span
                    className="tabular cursor-help underline decoration-dotted underline-offset-4"
                  />
                }
              >
                <span className="text-foreground/70">
                  {SCORE_DIMENSION_LABELS[k]}
                </span>{" "}
                {breakdown[k] ?? "—"}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left leading-relaxed">
                {SCORE_DIMENSION_TOOLTIPS[k]}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : null}
    </>
  );
}
