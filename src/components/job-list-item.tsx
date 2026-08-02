"use client";

import { ExternalLink, MoreHorizontal } from "lucide-react";
import { JobMatchInsights } from "@/components/match-insights";
import { ScoreBadge } from "@/components/score-badge";
import { Surface } from "@/components/page-shell";
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
import type { JobTriageRow } from "@/components/jobs-inbox";

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

  return (
    <Surface className="interactive-lift overflow-hidden">
      <div className="px-4 py-4">
        <button
          type="button"
          className="w-full text-left transition-colors duration-150 ease-[var(--ease-out-soft)] hover:bg-transparent"
          onClick={onToggle}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-[17px] font-medium leading-snug">{row.title}</p>
              <p className="text-muted-foreground mt-1 text-[15px]">
                {row.companyName}
                {row.location ? ` · ${row.location}` : ""}
                {row.remotePolicy ? ` · ${row.remotePolicy}` : ""}
              </p>
            </div>
            <ScoreBadge
              score={row.matchScore}
              kind="match"
              size={variant === "interested" ? "sm" : "md"}
            />
          </div>
        </button>

        <div
          className={
            expanded ? "animate-expand mt-3 border-t pt-3" : undefined
          }
        >
          <JobMatchInsights
            expanded={expanded}
            title={row.title}
            companyName={row.companyName}
            location={row.location}
            remotePolicy={row.remotePolicy}
            sourceUrl={row.sourceUrl}
            remoteFit={row.remoteFit}
            remoteRequired={row.remoteRequired}
            matchingReasons={row.matchingReasons}
            concerns={row.concerns}
            mainRisk={row.mainRisk}
            missingRequirements={row.missingRequirements}
            sheetPrimaryAction={sheetPrimary}
          />
        </div>
      </div>

      {expanded ? (
        <div className="animate-expand space-y-3 border-t px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {variant === "today" ? (
              <>
                <Button size="sm" disabled={pending} onClick={onInterested}>
                  Interested
                </Button>
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border hover:bg-muted inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-3 text-[14px]"
                >
                  Open posting
                  <ExternalLink className="size-3.5" />
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" variant="ghost" disabled={pending} />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">More actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48">
                    <DropdownMenuItem
                      onClick={onSaveForLater}
                      disabled={pending}
                      title="Keep on Today for later — not the same as Interested."
                    >
                      Save for later
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
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={onMarkApplied}
                      />
                    }
                  >
                    Mark applied
                  </TooltipTrigger>
                  <TooltipContent>
                    Removes it from Interested and records that you already
                    applied outside Optra.
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
        </div>
      ) : null}
    </Surface>
  );
}
