"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  highlightsFromReasons,
  policyLabel,
  remoteStatusLabel,
  timezoneLabel,
  type RemoteFit,
} from "@/modules/matching/remote-fit";

const PREVIEW_REASON_COUNT = 3;

function statusTone(status: RemoteFit["status"]) {
  if (status === "pass") {
    return "bg-primary/15 text-primary ring-1 ring-primary/30";
  }
  if (status === "fail") {
    return "bg-destructive/15 text-destructive ring-1 ring-destructive/30";
  }
  return "bg-amber-500/12 text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-100";
}

function StatusIcon({ status }: { status: RemoteFit["status"] }) {
  if (status === "pass") return <Check className="size-3.5 shrink-0" />;
  if (status === "fail") return <X className="size-3.5 shrink-0" />;
  return <AlertTriangle className="size-3.5 shrink-0" />;
}

export function MatchConstraintChips({
  remoteFit,
  onOpen,
  showTimezone = true,
}: {
  remoteFit: RemoteFit;
  onOpen: () => void;
  /** Hide when every card in the list shares the same overlap. */
  showTimezone?: boolean;
}) {
  const tz = showTimezone ? timezoneLabel(remoteFit.timezoneOverlap) : null;

  const open = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen();
  };

  return (
    <div className="flex h-7 flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={open}
        className={cn(
          "inline-flex h-full items-center gap-1 rounded-[14px] px-2 py-1 text-[13px] font-medium transition-colors hover:brightness-110",
          remoteFit.status === "pass" && "bg-primary/15 text-primary",
          remoteFit.status === "fail" && "bg-destructive/15 text-destructive",
          remoteFit.status === "unclear" &&
            "bg-amber-500/12 text-amber-900 dark:text-amber-100",
        )}
        title={remoteFit.summary}
      >
        <Globe2 className="size-3.5 opacity-80" />
        {remoteStatusLabel(remoteFit.status)}
      </button>
      {tz ? (
        <button
          type="button"
          onClick={open}
          className={cn(
            "inline-flex h-full items-center gap-1 rounded-[14px] px-2 py-1 text-[13px] font-medium transition-colors hover:brightness-110",
            remoteFit.timezoneOverlap === "full" &&
              "bg-primary/10 text-primary",
            remoteFit.timezoneOverlap === "partial" &&
              "bg-amber-500/10 text-amber-900 dark:text-amber-100",
            remoteFit.timezoneOverlap === "poor" &&
              "bg-destructive/10 text-destructive",
          )}
          title="Timezone overlap vs your profile"
        >
          <Clock className="size-3.5 opacity-80" />
          {tz}
        </button>
      ) : null}
    </div>
  );
}

function RemoteDecisionCard({
  remoteFit,
  location,
  remotePolicy,
  remoteRequired,
  onOpen,
}: {
  remoteFit: RemoteFit;
  location: string | null;
  remotePolicy: string | null;
  remoteRequired: boolean;
  onOpen: () => void;
}) {
  const posted = remotePolicy?.trim() || location?.trim() || "Not stated";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-xl px-3.5 py-3 text-left ring-1 transition-colors hover:bg-white/3",
        statusTone(remoteFit.status),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <StatusIcon status={remoteFit.status} />
          <div className="min-w-0">
            <p className="text-[15px] font-medium leading-snug">
              {remoteRequired
                ? "Can you work remote?"
                : "Remote / location fit"}
            </p>
            <p className="mt-1 text-[14px] leading-snug opacity-90">
              {remoteFit.summary}
            </p>
            <p className="mt-1.5 text-[13px] opacity-70">
              Posted: {posted}
              {" · "}
              {policyLabel(remoteFit.policy)}
              {remoteFit.timezoneOverlap !== "unknown"
                ? ` · ${timezoneLabel(remoteFit.timezoneOverlap)}`
                : ""}
            </p>
          </div>
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-70" />
      </div>
    </button>
  );
}

function HighlightList({
  reasons,
  limit,
}: {
  reasons: string[];
  limit?: number;
}) {
  const highlights = highlightsFromReasons(reasons);
  const shown = limit != null ? highlights.slice(0, limit) : highlights;
  const more = limit != null ? Math.max(0, highlights.length - limit) : 0;

  return (
    <div>
      <ul className="space-y-2">
        {shown.map((h) => (
          <li key={`${h.label}:${h.detail}`} className="flex gap-2.5">
            <span className="bg-primary/15 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
              <Check className="size-3" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium leading-snug">{h.label}</p>
              {h.detail ? (
                <p className="text-muted-foreground mt-0.5 text-[14px] leading-snug">
                  {h.detail}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <p className="text-muted-foreground mt-2 text-[13px]">+{more} more</p>
      ) : null}
    </div>
  );
}

function WatchList({ concerns }: { concerns: string[] }) {
  if (concerns.length === 0) return null;
  return (
    <ul className="space-y-2">
      {concerns.map((c) => (
        <li key={c} className="flex gap-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-100">
            <AlertTriangle className="size-3" />
          </span>
          <p className="text-[14px] leading-snug">{c}</p>
        </li>
      ))}
    </ul>
  );
}

function MatchRationaleSheet({
  open,
  onOpenChange,
  title,
  companyName,
  location,
  remotePolicy,
  sourceUrl,
  remoteFit,
  remoteRequired,
  matchingReasons,
  concerns,
  mainRisk,
  missingRequirements,
  primaryAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  companyName: string;
  location: string | null;
  remotePolicy: string | null;
  sourceUrl: string;
  remoteFit: RemoteFit;
  remoteRequired: boolean;
  matchingReasons: string[];
  concerns: string[];
  mainRisk: string | null;
  missingRequirements: string[];
  primaryAction?: ReactNode;
}) {
  const posted = remotePolicy?.trim() || location?.trim() || "Not stated";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="border-b">
          <SheetTitle className="pr-8 text-[18px] leading-snug">
            {title}
          </SheetTitle>
          <SheetDescription>
            {companyName}
            {location ? ` · ${location}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <section
            className={cn(
              "rounded-xl px-3.5 py-3 ring-1",
              statusTone(remoteFit.status),
            )}
          >
            <div className="flex items-center gap-2 text-[15px] font-medium">
              <StatusIcon status={remoteFit.status} />
              {remoteRequired ? "Remote verdict" : "Location / remote"}
            </div>
            <p className="mt-2 text-[14px] leading-snug opacity-90">
              {remoteFit.summary}
            </p>
            <dl className="mt-3 grid gap-1.5 text-[13px] opacity-80">
              <div className="flex justify-between gap-3">
                <dt>Posted</dt>
                <dd className="text-right font-medium">{posted}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Policy</dt>
                <dd className="font-medium">{policyLabel(remoteFit.policy)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Geo</dt>
                <dd className="font-medium">
                  {remoteFit.geoOk === true
                    ? "Looks OK"
                    : remoteFit.geoOk === false
                      ? "Likely blocked"
                      : "Unknown"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Timezone</dt>
                <dd className="font-medium">
                  {timezoneLabel(remoteFit.timezoneOverlap) ?? "Unknown"}
                </dd>
              </div>
            </dl>
            {remoteFit.evidence.length > 0 ? (
              <ul className="mt-3 space-y-1 border-t border-current/10 pt-3 text-[13px] opacity-85">
                {remoteFit.evidence.map((e) => (
                  <li key={e}>· {e}</li>
                ))}
              </ul>
            ) : null}
          </section>

          {matchingReasons.length > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-2 text-[14px] font-medium">
                Why it matches
              </h3>
              <HighlightList reasons={matchingReasons} />
            </section>
          ) : null}

          {concerns.length > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-2 text-[14px] font-medium">
                Things to watch
              </h3>
              <WatchList concerns={concerns} />
            </section>
          ) : null}

          {mainRisk ? (
            <section className="rounded-xl bg-amber-500/10 px-3.5 py-3 ring-1 ring-amber-500/25">
              <h3 className="text-[14px] font-medium text-amber-900 dark:text-amber-100">
                Main risk
              </h3>
              <p className="mt-1 text-[14px] leading-snug opacity-90">
                {mainRisk}
              </p>
            </section>
          ) : null}

          {missingRequirements.length > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-2 text-[14px] font-medium">
                Missing / unclear
              </h3>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-[14px]">
                {missingRequirements.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <SheetFooter className="border-t sm:flex-row sm:items-center">
          {primaryAction}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="border-border hover:bg-muted inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[14px]"
          >
            Open posting
            <ExternalLink className="size-3.5" />
          </a>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export type JobMatchInsightsProps = {
  expanded: boolean;
  title: string;
  companyName: string;
  location: string | null;
  remotePolicy: string | null;
  sourceUrl: string;
  remoteFit: RemoteFit;
  remoteRequired: boolean;
  matchingReasons: string[];
  concerns: string[];
  mainRisk: string | null;
  missingRequirements: string[];
  /** Shown in the rationale sheet footer (e.g. Interested). */
  sheetPrimaryAction?: ReactNode;
  /** Controlled rationale sheet — use when chips live in the card header. */
  rationaleOpen?: boolean;
  onRationaleOpenChange?: (open: boolean) => void;
};

/**
 * Hybrid match insights: decision card + scannable reasons when expanded,
 * Sheet for the full AI rationale. Constraint chips live on the card header.
 */
export function JobMatchInsights({
  expanded,
  title,
  companyName,
  location,
  remotePolicy,
  sourceUrl,
  remoteFit,
  remoteRequired,
  matchingReasons,
  concerns,
  mainRisk,
  missingRequirements,
  sheetPrimaryAction,
  rationaleOpen,
  onRationaleOpenChange,
}: JobMatchInsightsProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = rationaleOpen ?? uncontrolledOpen;
  const setOpen = onRationaleOpenChange ?? setUncontrolledOpen;
  const hasReasons = matchingReasons.length > 0;
  const hasWatch = concerns.length > 0;

  return (
    <>
      {expanded ? (
        <div className="space-y-3">
          <RemoteDecisionCard
            remoteFit={remoteFit}
            location={location}
            remotePolicy={remotePolicy}
            remoteRequired={remoteRequired}
            onOpen={() => setOpen(true)}
          />

          {hasReasons ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-[14px] font-medium">
                  Why it matches
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="text-primary text-[13px] font-medium hover:underline"
                >
                  Full rationale
                </button>
              </div>
              <HighlightList
                reasons={matchingReasons}
                limit={PREVIEW_REASON_COUNT}
              />
            </div>
          ) : null}

          {hasWatch ? (
            <div>
              <p className="text-muted-foreground mb-2 text-[14px] font-medium">
                Things to watch
              </p>
              <WatchList concerns={concerns.slice(0, 3)} />
            </div>
          ) : null}
        </div>
      ) : null}

      <MatchRationaleSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        companyName={companyName}
        location={location}
        remotePolicy={remotePolicy}
        sourceUrl={sourceUrl}
        remoteFit={remoteFit}
        remoteRequired={remoteRequired}
        matchingReasons={matchingReasons}
        concerns={concerns}
        mainRisk={mainRisk}
        missingRequirements={missingRequirements}
        primaryAction={sheetPrimaryAction}
      />
    </>
  );
}
