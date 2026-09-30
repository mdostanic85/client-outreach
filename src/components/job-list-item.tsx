"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { MatchConstraintChips } from "@/components/match-insights";
import { ScoreBadge } from "@/components/score-badge";
import { Badge } from "@/components/ui/badge";
import type { PackageListMeta } from "@/modules/applications/packages";
import type { JobTriageRow } from "@/modules/jobs/triage-row";
import { jobFacts, packageBadgeLabel } from "@/modules/jobs/job-presentation";

export type JobListVariant = "today" | "interested";

/**
 * One job in a list. The whole row is a link (stretched) to the job page,
 * where the full details and every action live.
 */
export function JobListItem({
  row,
  variant = "today",
  packageMeta,
  showTimezoneChip = true,
}: {
  row: JobTriageRow;
  variant?: JobListVariant;
  packageMeta?: PackageListMeta | null;
  /** When false, hide TZ chips (all cards share the same overlap). */
  showTimezoneChip?: boolean;
}) {
  const facts = jobFacts(row);
  const topReason = row.matchingReasons[0] ?? null;
  const badge = variant === "interested" ? packageBadgeLabel(packageMeta) : null;

  return (
    <div className="interactive-row group/row relative flex items-start gap-3 px-4 py-4 sm:items-center sm:gap-4 sm:px-6">
      <CompanyTile name={row.companyName} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          href={`/jobs/${row.jobId}`}
          prefetch={false}
          className="min-w-0 rounded-md after:absolute after:inset-0 after:content-['']"
        >
          <span className="text-foreground block truncate text-body-lg">{row.title}</span>
          <span className="text-muted-foreground block truncate text-body-sm">
            {[row.companyName, ...facts.slice(0, 2)].join(" · ")}
          </span>
        </Link>
        {topReason || row.remoteRequired || badge ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
            {/* Remote verdicts only mean something when the person asked for remote. */}
            {row.remoteRequired ? (
              <MatchConstraintChips
                remoteFit={row.remoteFit}
                showTimezone={showTimezoneChip}
                interactive={false}
                onOpen={() => {}}
              />
            ) : null}
            {topReason ? (
              <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-body-sm">
                <Check className="text-brand-ink size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{topReason}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Phones show just the number; the tier label returns from sm up. */}
        <ScoreBadge
          score={row.matchScore}
          kind="match"
          size={variant === "interested" ? "sm" : "md"}
          className="relative z-10 max-sm:[&>span:last-child]:hidden"
        />
        <ChevronRight
          aria-hidden
          className="text-ink-tertiary group-hover/row:text-foreground hidden size-4 transition-[color,translate] duration-150 ease-standard group-hover/row:translate-x-0.5 sm:block"
        />
      </div>
    </div>
  );
}

/** Monogram tile in the logo slot (12px radius, subtle tint). */
export function CompanyTile({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={
        size === "lg"
          ? "bg-subtle text-ink-emphasis grid size-14 shrink-0 place-items-center rounded-panel text-h5"
          : "bg-subtle text-ink-emphasis grid size-10 shrink-0 place-items-center rounded-tile text-body"
      }
    >
      {letter}
    </span>
  );
}
