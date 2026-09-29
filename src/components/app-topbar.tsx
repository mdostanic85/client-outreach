"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ChevronRight, LogOut, Menu, Radar, SlidersHorizontal, X } from "lucide-react";
import { AppSidebarNav, navContextFor } from "@/components/app-sidebar";
import { useJobSearch } from "@/components/job-search-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/modules/auth/actions";
import type { JobSearchStatus } from "@/modules/jobs/queries";
import { SEARCH_UX_STAGES, stageIndex, uxStageFromJobStep } from "@/modules/search-experience/stages";
import { cn } from "@/lib/utils";

function initials(email?: string) {
  if (!email) return "?";
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

type BudgetMeter = {
  spentUsd: number;
  budgetUsd: number;
  hardStopped?: boolean;
  alert?: string;
};

/** Minute-resolution clock; null on the server and during hydration so they agree. */
const subscribeMinute = (tick: () => void) => {
  const id = window.setInterval(tick, 60_000);
  return () => window.clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
function useNow(): number | null {
  return useSyncExternalStore(subscribeMinute, currentMinute, () => null);
}

function formatAgo(iso: string | null, now: number | null): string | null {
  if (!iso || now == null) return null;
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function PageContext() {
  const pathname = usePathname();
  const context = navContextFor(pathname);
  if (!context) return null;
  const Icon = context.item.icon;
  const deeper = pathname !== context.item.href;
  return (
    <nav aria-label="Current page" className="hidden min-w-0 items-center gap-2 text-[14px] md:flex">
      <span className="text-muted-foreground/80 text-[12px] font-semibold tracking-[0.08em] uppercase">
        {context.group}
      </span>
      <ChevronRight aria-hidden className="text-muted-foreground/50 size-3.5 shrink-0" />
      {deeper ? (
        <Link
          href={context.item.href}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 truncate transition-colors"
        >
          <Icon className="size-4 shrink-0" />
          {context.item.label}
        </Link>
      ) : (
        <span aria-current="page" className="flex items-center gap-1.5 truncate font-medium text-[var(--card-foreground)]">
          <Icon className="text-primary size-4 shrink-0" />
          {context.item.label}
        </span>
      )}
    </nav>
  );
}

/**
 * The topbar's main job: start job discovery from anywhere and follow it while
 * browsing. Idle → last run + unreviewed count; running → live stage and %.
 */
function JobSearchControl({ status }: { status: JobSearchStatus }) {
  const search = useJobSearch();
  const now = useNow();

  if (!search.running && search.pageOwnsCta) return null;

  if (search.running) {
    const percent = Math.max(0, Math.min(100, Math.round(search.live?.percent ?? 0)));
    const stage = SEARCH_UX_STAGES[stageIndex(uxStageFromJobStep(search.live?.stepId ?? "collect"))];
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={search.showOverlay}
          className="group bg-primary/10 hover:bg-primary/15 ring-primary/25 flex h-9 min-w-0 items-center gap-2.5 rounded-full pr-3.5 pl-3 text-left ring-1 transition-colors"
          aria-label={`Job search ${percent}% — open progress`}
        >
          <span aria-hidden className="relative flex size-2 shrink-0">
            <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60" />
            <span className="bg-primary relative inline-flex size-2 rounded-full" />
          </span>
          <span className="min-w-0 truncate text-[13px]">
            <span className="font-medium text-[var(--card-foreground)]">{stage?.label ?? "Searching"}</span>
            {search.live?.detail ? (
              <span className="text-muted-foreground hidden lg:inline"> · {search.live.detail}</span>
            ) : null}
          </span>
          <span className="tabular text-primary shrink-0 text-[13px] font-semibold">{percent}%</span>
        </button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-xs" onClick={search.cancel} aria-label="Cancel job search" />
            }
          >
            <X />
          </TooltipTrigger>
          <TooltipContent>Cancel search</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  if (!status.hasSearchProfile) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-muted-foreground hidden truncate text-[13px] sm:inline">
          Approve search criteria to start finding jobs
        </span>
        <Link href="/search-criteria" className={buttonVariants({ size: "sm", variant: "secondary" })}>
          <SlidersHorizontal />
          Set criteria
        </Link>
      </div>
    );
  }

  const error = search.notice.error;
  const lastRun = search.lastOutcome?.finishedAt ?? status.lastRunAt;
  const ago = formatAgo(lastRun, now);
  const outcome = search.lastOutcome;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {error ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="text-destructive hidden min-w-0 cursor-help items-center gap-1.5 truncate text-[13px] sm:flex" />
            }
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            Last search failed
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-left">{error}</TooltipContent>
        </Tooltip>
      ) : (
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground hidden min-w-0 items-center gap-2 truncate text-[13px] transition-colors sm:flex"
        >
          {outcome ? (
            <span className="truncate">
              <span className="font-medium text-[var(--card-foreground)]">{outcome.strong} strong</span>
              {" · "}
              {outcome.worth} worth a look
            </span>
          ) : status.toReview > 0 ? (
            <span className="truncate">
              <span className="tabular font-medium text-[var(--card-foreground)]">{status.toReview}</span> to review
            </span>
          ) : (
            <span className="truncate">Shortlist reviewed</span>
          )}
          {ago ? <span className="text-muted-foreground/70 shrink-0">· searched {ago}</span> : null}
        </Link>
      )}
      <Button size="sm" onClick={search.start} className="shrink-0">
        <Radar />
        {error ? "Retry" : "Find jobs"}
      </Button>
    </div>
  );
}

function BudgetPill({ budget }: { budget: BudgetMeter }) {
  const ratio = budget.budgetUsd > 0 ? budget.spentUsd / budget.budgetUsd : 0;
  const tone = budget.hardStopped ? "critical" : ratio >= 0.75 ? "warn" : "ok";
  const tip = budget.hardStopped
    ? `AI budget hard-stopped. Spent $${budget.spentUsd.toFixed(0)} of $${budget.budgetUsd}. New AI calls are blocked until next month or you raise the limit in Admin.`
    : `Estimated LLM spend this month: $${budget.spentUsd.toFixed(0)} of $${budget.budgetUsd}.${budget.alert ? ` ${budget.alert}` : ""} Hard stop blocks new AI calls when reached.`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "inline-flex h-8 cursor-help items-center gap-2 rounded-full px-2.5 text-[13px]",
              tone === "critical" && "bg-destructive/12 text-destructive",
              tone === "warn" && "bg-[color-mix(in_oklab,var(--warn)_14%,transparent)] text-[var(--warn)]",
              tone === "ok" && "bg-secondary text-muted-foreground",
            )}
          />
        }
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tone === "critical" && "bg-destructive",
            tone === "warn" && "bg-[var(--warn)]",
            tone === "ok" && "bg-[var(--success)]",
          )}
        />
        <span className="hidden font-medium tracking-wide uppercase sm:inline">AI</span>
        <span className="tabular text-[var(--card-foreground)]">
          <span className="font-medium">${budget.spentUsd.toFixed(0)}</span>
          <span className="text-muted-foreground"> / ${budget.budgetUsd}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-relaxed">{tip}</TooltipContent>
    </Tooltip>
  );
}

function AccountMenu({ email }: { email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={formRef} action={signOutAction} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Account"
              className="bg-primary/18 text-primary focus-visible:ring-ring/50 grid size-8 place-items-center rounded-full text-[12px] font-semibold tracking-wide ring-1 ring-[color-mix(in_oklab,var(--primary)_35%,transparent)] outline-none focus-visible:ring-3"
            />
          }
        >
          {initials(email)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => formRef.current?.requestSubmit()}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/**
 * Sticky app chrome. Page H1 lives in PageHeader; the topbar carries page
 * context, the always-available job search, AI budget and account.
 */
export function AppTopbar({
  budget,
  userEmail,
  searchStatus,
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
  isOwner = false,
}: {
  /** Owner only — other accounts don't manage the AI bill. */
  budget?: BudgetMeter;
  userEmail?: string;
  searchStatus: JobSearchStatus;
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
  isOwner?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const { running, live } = useJobSearch();
  const percent = Math.max(0, Math.min(100, live?.percent ?? 0));

  return (
    <header className="border-border/80 bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-xl sm:gap-4 sm:px-8">
      <div className="flex min-w-0 shrink items-center gap-2">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
          <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[280px]">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebarNav
              queueCount={queueCount}
              interestedCount={interestedCount}
              profileFitCount={profileFitCount}
              isOwner={isOwner}
              onNavigate={() => setNavOpen(false)}
              className="h-full w-full border-0"
            />
          </SheetContent>
        </Sheet>
        <PageContext />
      </div>

      <div className="flex min-w-0 flex-1 justify-end md:justify-center">
        <JobSearchControl status={searchStatus} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {budget ? <BudgetPill budget={budget} /> : null}
        {userEmail ? <AccountMenu email={userEmail} /> : null}
      </div>

      {running ? (
        <div
          aria-hidden
          className="bg-primary/15 absolute inset-x-0 -bottom-px h-[2px] overflow-hidden"
        >
          <div
            className="search-progress-fill h-full"
            style={{ width: `${Math.max(3, percent)}%` }}
          />
        </div>
      ) : null}
    </header>
  );
}
