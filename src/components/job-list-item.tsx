"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  ExternalLink,
  MoreHorizontal,
  ThumbsDown,
  Undo2,
} from "lucide-react";
import { getJobDescriptionAction } from "@/app/actions";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

  const facts = [
    row.location,
    row.remotePolicy,
    row.employmentType,
    row.companySnapshot.salaryText,
  ].filter((fact): fact is string => Boolean(fact?.trim()));
  const posted = formatPosted(row.postedAt);
  const topReason = row.matchingReasons[0] ?? null;

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
  } as const;

  const moreMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="outline"
            disabled={pending}
            aria-label="More actions"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-52">
        {variant === "today" ? (
          <>
            <DropdownMenuItem
              onClick={onSaveForLater}
              disabled={pending}
              title="Stays on Today so you can decide later."
            >
              <Clock />
              Decide later
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAlreadyApplied} disabled={pending}>
              <CheckCheck />
              Already applied
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={onMarkApplied}
              disabled={pending}
              title="Records that you already applied outside Optra."
            >
              <CheckCheck />
              Mark applied
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveToToday} disabled={pending}>
              <Undo2 />
              Move back to Today
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={onStartReject}
          disabled={pending}
        >
          <ThumbsDown />
          Not interested
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {/* The whole row opens the job detail panel (stretched button). */}
      <div className="interactive-row group/row relative flex items-start gap-3 px-4 py-4 sm:items-center sm:gap-4 sm:px-6">
        <CompanyTile name={row.companyName} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            className="min-w-0 rounded-md text-left after:absolute after:inset-0 after:content-['']"
          >
            <span className="text-foreground block truncate text-body-lg">{row.title}</span>
            <span className="text-muted-foreground block truncate text-body-sm">
              {[row.companyName, ...facts.slice(0, 2)].join(" · ")}
            </span>
          </button>
          {topReason || row.remoteRequired || (variant === "interested" && packageBadgeLabel) ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              {variant === "interested" && packageBadgeLabel ? (
                <Badge variant="secondary">{packageBadgeLabel}</Badge>
              ) : null}
              {/* Remote verdicts only mean something when the person asked for remote. */}
              {row.remoteRequired ? (
                <MatchConstraintChips
                  remoteFit={row.remoteFit}
                  showTimezone={showTimezoneChip}
                  interactive={false}
                  onOpen={onToggle}
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

      <Sheet
        open={expanded}
        onOpenChange={(open) => {
          if (!open) {
            if (rejecting) onCancelReject?.();
            onToggle();
          }
        }}
      >
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-border gap-4 border-b">
            <div className="flex items-start gap-3">
              <CompanyTile name={row.companyName} />
              <div className="min-w-0">
                <SheetTitle className="text-h5">{row.title}</SheetTitle>
                <SheetDescription>
                  {row.companyName}
                  {posted ? ` · Posted ${posted}` : ""}
                </SheetDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ScoreBadge score={row.matchScore} kind="match" />
              {variant === "interested" && packageBadgeLabel ? (
                <Badge variant="secondary" size="lg">{packageBadgeLabel}</Badge>
              ) : null}
              {facts.map((fact) => (
                <Badge key={fact} variant="outline" size="lg">
                  {fact}
                </Badge>
              ))}
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-6">
            {rejecting ? (
              <section
                ref={(node) => node?.scrollIntoView({ block: "nearest" })}
                className="bg-subtle space-y-3 rounded-panel p-4"
              >
                <h3 className="text-foreground text-body font-medium">
                  Why isn&apos;t it a fit?
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {REJECT_REASONS.map((reason) => (
                    <Button
                      key={reason}
                      size="sm"
                      variant={rejectReason === reason ? "primary" : "outline"}
                      aria-pressed={rejectReason === reason}
                      disabled={pending}
                      onClick={() => onRejectReason(reason)}
                    >
                      {reason}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Or type a reason"
                  aria-label="Reason"
                  value={rejectReason ?? ""}
                  onChange={(e) => onRejectReason(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending || !rejectReason?.trim()}
                    onClick={onConfirmReject}
                  >
                    Not interested
                  </Button>
                  {onCancelReject ? (
                    <Button size="sm" variant="ghost" onClick={onCancelReject}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

            <DetailSection title="Why it fits">
              <JobMatchInsights
                expanded
                enableRationaleSheet={false}
                matchDimensions={row.matchDimensions}
                {...insightsProps}
              />
            </DetailSection>

            <DetailSection title="Company">
              <CompanySnapshotCard
                snapshot={row.companySnapshot}
                location={row.location}
                remotePolicy={row.remotePolicy}
                expandable={false}
              />
            </DetailSection>

            <DetailSection title="Job description">
              <JobDescription jobId={row.jobId} active={expanded} />
            </DetailSection>
          </div>

          <SheetFooter className="border-border flex-row flex-wrap items-center gap-2 border-t">
            {variant === "today" ? (
              <Button disabled={pending} onClick={onInterested} className="flex-1 sm:flex-none">
                <Bookmark />
                Save
              </Button>
            ) : (
              <Link
                href={packageCta.href}
                className={buttonVariants({ className: "flex-1 sm:flex-none" })}
              >
                {packageCta.label}
              </Link>
            )}
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", className: "flex-1 sm:flex-none" })}
            >
              Open posting
              <ExternalLink className="size-3.5" />
            </a>
            <div className="sm:ml-auto">{moreMenu}</div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-foreground text-body font-medium">{title}</h3>
      {children}
    </section>
  );
}

const DESCRIPTION_PREVIEW = 900;

/** Posting text, fetched once when the panel first opens. */
function JobDescription({ jobId, active }: { jobId: string; active: boolean }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "done"; text: string } | { status: "error" }
  >({ status: "loading" });
  const [showAll, setShowAll] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    let cancelled = false;
    void getJobDescriptionAction(jobId).then((res) => {
      if (cancelled) return;
      if (res.ok) setState({ status: "done", text: res.data.description.trim() });
      else setState({ status: "error" });
    });
    return () => {
      cancelled = true;
      requested.current = false;
    };
  }, [active, jobId]);

  if (state.status === "error") {
    return (
      <p className="text-muted-foreground text-body-sm">
        Couldn&apos;t load the description right now. Open the posting to read it.
      </p>
    );
  }
  if (state.status !== "done") {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading description">
        {[92, 100, 84, 96, 60].map((w) => (
          <div
            key={w}
            className="bg-subtle h-3.5 animate-pulse rounded-full motion-reduce:animate-none"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    );
  }
  if (!state.text) {
    return (
      <p className="text-muted-foreground text-body-sm">
        The posting didn&apos;t include a description. Open the posting for details.
      </p>
    );
  }
  const long = state.text.length > DESCRIPTION_PREVIEW;
  const shown = long && !showAll ? `${state.text.slice(0, DESCRIPTION_PREVIEW).trimEnd()}…` : state.text;
  return (
    <div className="space-y-3">
      <p className="text-ink-emphasis text-body-sm whitespace-pre-line">{shown}</p>
      {long ? (
        <Button size="sm" variant="ghost" className="-ml-3" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : "Show full description"}
        </Button>
      ) : null}
    </div>
  );
}

/** "3 Oct" style date; fixed locale and UTC so server and client agree. */
function formatPosted(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
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
