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
import { Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import type { PackageListMeta } from "@/modules/applications/packages";
import type { JobTriageRow } from "@/modules/jobs/triage-row";

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

function reasonText(reason: string) {
  const [, detail] = reason.split(/:(.+)/);
  return (detail ?? reason).trim();
}

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
      return { href: "/queue?tab=applications", label: "View in Queue" };
    }
    if (readyToSend) {
      return {
        href: `/interested/${row.jobId}/package?send=1`,
        label: "Send",
      };
    }
    return { href: `/interested/${row.jobId}/package`, label: "Prepare" };
  })();

  const packageBadgeLabel = (() => {
    if (alreadySent) return "Sent";
    if (packageState === "prepared") return "Prepared";
    if (packageState === "approved") return "Approved";
    if (packageState === "draft") return "Draft pack";
    return null;
  })();

  const sheetPrimary =
    variant === "today" && onInterested ? (
      <Button size="sm" disabled={pending} onClick={onInterested}>
        Interested
      </Button>
    ) : variant === "interested" && onMarkApplied ? (
      <Button size="sm" disabled={pending} onClick={onMarkApplied}>
        Mark applied
      </Button>
    ) : null;

  const roleMeta = [row.companyName, row.location, row.companySnapshot.salaryText]
    .filter(Boolean)
    .join(" · ");

  const topReasons = row.matchingReasons.slice(0, 2).map(reasonText);

  const insightsProps = {
    title: row.title,
    companyName: row.companyName,
    location: row.location,
    remotePolicy: row.remotePolicy,
    sourceUrl: row.sourceUrl,
    remoteFit: row.remoteFit,
    remoteRequired: row.remoteRequired,
    matchingReasons: row.matchingReasons,
    concerns: row.concerns,
    mainRisk: row.mainRisk,
    missingRequirements: row.missingRequirements,
    sheetPrimaryAction: sheetPrimary,
    rationaleOpen,
    onRationaleOpenChange: setRationaleOpen,
  } as const;

  return (
    <Surface className="overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={onToggle}
          >
            <p className="text-foreground text-[17px] font-semibold leading-snug">
              {row.title}
            </p>
            <p className="text-muted-foreground mt-1 text-[14px] leading-snug">
              {roleMeta}
            </p>
          </button>

          <ScoreBadge
            score={row.matchScore}
            kind="match"
            size="sm"
            className="shrink-0"
            onClick={onToggle}
          />
        </div>

        {variant === "today" ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MatchConstraintChips
                remoteFit={row.remoteFit}
                showTimezone={showTimezoneChip}
                onOpen={() => setRationaleOpen(true)}
              />
            </div>

            {topReasons.length > 0 ? (
              <ul className="text-muted-foreground mt-3 space-y-1 text-[14px] leading-snug">
                {topReasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={pending} onClick={onInterested}>
                Interested
              </Button>
              <Button size="sm" variant="outline" onClick={onToggle}>
                {expanded ? "Hide details" : "Details"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button size="sm" variant="ghost" disabled={pending} />}
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-48">
                  <DropdownMenuItem onClick={onSaveForLater} disabled={pending}>
                    Save for later
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAlreadyApplied} disabled={pending}>
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
            </div>
          </>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MatchConstraintChips
              remoteFit={row.remoteFit}
              showTimezone={showTimezoneChip}
              onOpen={() => setRationaleOpen(true)}
            />
            {packageBadgeLabel ? (
              <Badge variant="secondary" className="text-[13px]">
                {packageBadgeLabel}
              </Badge>
            ) : null}
          </div>
        )}

        {expanded ? (
          <div className="animate-expand mt-4 space-y-3 border-t pt-4">
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

      {expanded && variant === "interested" ? (
        <div className="animate-expand space-y-3 border-t px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={packageCta.href}
              className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-[34px] items-center rounded-lg px-3 text-[14px] font-medium"
            >
              {packageCta.label}
            </Link>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button size="sm" disabled={pending} onClick={onMarkApplied} />
                }
              >
                Mark applied
              </TooltipTrigger>
              <TooltipContent>
                Removes it from Interested and records that you already applied
                outside Optra.
              </TooltipContent>
            </Tooltip>
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="border-border hover:bg-muted inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-3 text-[14px]"
            >
              Open posting
              <ExternalLink className="size-3.5" />
            </a>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={onMoveToToday}
            >
              Move to Today
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={onStartReject}
            >
              Not interested
            </Button>
          </div>
        </div>
      ) : null}

      {rejecting ? (
        <div className="space-y-2 border-t px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((reason) => (
              <Button
                key={reason}
                size="sm"
                variant={rejectReason === reason ? "secondary" : "outline"}
                disabled={pending}
                onClick={() => onRejectReason(reason)}
              >
                {reason}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
    </Surface>
  );
}
