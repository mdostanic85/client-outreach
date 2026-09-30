"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import { CompanySnapshotCard } from "@/components/company-snapshot";
import {
  JobMatchInsights,
  MatchConstraintChips,
} from "@/components/match-insights";
import { ScoreBadge } from "@/components/score-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { PackageListMeta } from "@/modules/applications/packages";
import type { JobTriageRow } from "@/modules/jobs/triage-row";
import { cn } from "@/lib/utils";

const REJECT_REASONS = [
  "Wrong title",
  "Wrong seniority",
  "Wrong location / remote",
  "Wrong industry",
  "Comp too low",
  "Company type mismatch",
  "Other",
] as const;

export type JobListVariant = "today" | "interested";

export function JobListItem({
  row,
  expanded,
  pending,
  variant = "today",
  rejecting,
  rejectReason,
  packageMeta,
  showTimezoneChip = true,
  onToggle,
  onInterested,
  onSaveForLater,
  onAlreadyApplied,
  onMarkApplied,
  onMoveToToday,
  onStartReject,
  onRejectReason,
  onConfirmReject,
  onCancelReject,
}: {
  row: JobTriageRow;
  expanded: boolean;
  pending: boolean;
  variant?: JobListVariant;
  rejecting?: boolean;
  rejectReason?: string;
  packageMeta?: PackageListMeta | null;
  /** When false, hide TZ chips (all cards share the same overlap). */
  showTimezoneChip?: boolean;
  onToggle: () => void;
  onInterested?: () => void;
  onSaveForLater?: () => void;
  onAlreadyApplied?: () => void;
  onMarkApplied?: () => void;
  onMoveToToday?: () => void;
  onStartReject: () => void;
  onRejectReason: (value: string) => void;
  onConfirmReject: () => void;
  onCancelReject?: () => void;
}) {
  const [rationaleOpen, setRationaleOpen] = useState(false);

  const packageState = packageMeta?.state ?? null;
  const mailStatus = packageMeta?.mailStatus ?? "none";
  const alreadySent =
    mailStatus === "sent" ||
    mailStatus === "waiting" ||
    mailStatus === "follow_up";
  const readyToSend =
    !alreadySent &&
    (packageState === "prepared" || packageState === "approved");

  const packageCta = (() => {
    if (alreadySent) {
      return {
        href: "/queue?tab=applications",
        label: "View in Queue",
      };
    }
    if (readyToSend) {
      return {
        href: `/interested/${row.jobId}/package?send=1`,
        label: "Send",
      };
    }
    return {
      href: `/interested/${row.jobId}/package`,
      label: "Prepare",
    };
  })();

  const packageBadgeLabel = (() => {
    if (alreadySent) return "Sent";
    if (packageState === "prepared") return "Prepared";
    if (packageState === "approved") return "Approved";
    if (packageState === "draft") return "Draft pack";
    return null;
  })();

  const roleLine = [row.title, row.location, row.companySnapshot.salaryText]
    .filter(Boolean)
    .join(" · ");

  const insightsProps = {
    title: row.title,
    companyName: row.companyName,
    location: row.location,
    remotePolicy: row.remotePolicy,
    remoteFit: row.remoteFit,
    remoteRequired: row.remoteRequired,
    matchingReasons: row.matchingReasons,
    concerns: row.concerns,
    mainRisk: row.mainRisk,
    missingRequirements: row.missingRequirements,
    rationaleOpen,
    onRationaleOpenChange: setRationaleOpen,
  } as const;

  return (
    <div className={cn(!expanded && "interactive-row")}>
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <CompanyTile name={row.companyName} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 empty:hidden">
              {/* Remote verdicts only mean something when the person asked for remote. */}
              {row.remoteRequired ? (
                <MatchConstraintChips
                  remoteFit={row.remoteFit}
                  showTimezone={showTimezoneChip}
                  onOpen={() => setRationaleOpen(true)}
                />
              ) : null}
              {variant === "interested" && packageBadgeLabel ? (
                <Badge variant="secondary">{packageBadgeLabel}</Badge>
              ) : null}
            </div>
            <button
              type="button"
              className="w-full min-w-0 rounded-md text-left"
              onClick={onToggle}
              aria-expanded={expanded}
            >
              <p className="text-foreground text-body-lg">{row.companyName}</p>
              <p className="text-muted-foreground text-body-sm sm:text-body">{roleLine}</p>
            </button>
          </div>
          <ScoreBadge
            score={row.matchScore}
            kind="match"
            size={variant === "interested" ? "sm" : "md"}
            className="self-start sm:self-center"
            onClick={onToggle}
          />
          </div>
        </div>

        {expanded ? (
          <div className="animate-expand mt-4 space-y-3 border-t border-border pt-4">
            <CompanySnapshotCard
              snapshot={row.companySnapshot}
              location={row.location}
              remotePolicy={row.remotePolicy}
            />
            <JobMatchInsights expanded {...insightsProps} />
          </div>
        ) : (
          <JobMatchInsights expanded={false} {...insightsProps} />
        )}
      </div>

      {expanded ? (
        <div className="animate-expand space-y-3 border-t border-border px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {variant === "today" ? (
              <>
                <Button size="sm" disabled={pending} onClick={onInterested}>
                  Save
                </Button>
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open posting
                  <ExternalLink className="size-3.5" />
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="icon-sm" variant="ghost" disabled={pending} />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">More actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48">
                    <DropdownMenuItem
                      onClick={onSaveForLater}
                      disabled={pending}
                      title="Stays on Today so you can decide later."
                    >
                      Decide later
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onAlreadyApplied}
                      disabled={pending}
                    >
                      Already applied
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={onStartReject}
                      disabled={pending}
                    >
                      Not interested
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link
                  href={packageCta.href}
                  className={buttonVariants({ size: "sm" })}
                >
                  {packageCta.label}
                </Link>
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open posting
                  <ExternalLink className="size-3.5" />
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="icon-sm" variant="ghost" disabled={pending} />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">More actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48">
                    <DropdownMenuItem
                      onClick={onMarkApplied}
                      disabled={pending}
                      title="Records that you already applied outside Optra."
                    >
                      Mark applied
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onMoveToToday} disabled={pending}>
                      Move back to Today
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onStartReject} disabled={pending}>
                      Not interested
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {rejecting ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASONS.map((reason) => (
                  <Button
                    key={reason}
                    size="sm"
                    variant={rejectReason === reason ? "primary" : "outline"}
                    disabled={pending}
                    onClick={() => onRejectReason(reason)}
                  >
                    {reason}
                  </Button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Or type a reason"
                  value={rejectReason ?? ""}
                  onChange={(e) => onRejectReason(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={pending || !rejectReason?.trim()}
                  onClick={onConfirmReject}
                >
                  Confirm
                </Button>
                {onCancelReject ? (
                  <Button size="sm" variant="ghost" onClick={onCancelReject}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 40px monogram tile in the logo slot (12px radius, subtle tint). */
function CompanyTile({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="bg-subtle text-ink-emphasis grid size-10 shrink-0 place-items-center rounded-tile text-body"
    >
      {letter}
    </span>
  );
}
