"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ChevronRight, LogOut, Menu, Radar, SlidersHorizontal, X } from "lucide-react";
import { AppSidebarNav, navContextFor } from "@/components/app-sidebar";
import { OptraLogo } from "@/components/optra-logo";
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

/**
 * True once the page has scrolled past `threshold` px. The topbar never hides;
 * its shadow only deepens a little (250ms).
 */
function useScrolledPast(threshold: number): boolean {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > threshold,
    () => false,
  );
}
const subscribeScroll = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
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
    <nav aria-label="Current page" className="hidden min-w-0 items-center gap-2 text-body-sm md:flex">
      <span className="text-muted-foreground">{context.group}</span>
      <ChevronRight aria-hidden className="text-ink-tertiary size-3.5 shrink-0" />
      {deeper ? (
        <Link
          href={context.item.href}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 truncate rounded-md transition-colors duration-150"
        >
          <Icon className="size-4 shrink-0" />
          {context.item.label}
        </Link>
      ) : (
        <span aria-current="page" className="text-foreground flex items-center gap-1.5 truncate">
          <Icon className="text-brand-ink size-4 shrink-0" />
          {context.item.label}
        </span>
      )}
    </nav>
  );
}

/** Phones hide the breadcrumb, so they still need to know which page is open. */
function MobilePageTitle() {
  const pathname = usePathname();
  const context = navContextFor(pathname);
  if (!context) return null;
  return (
    <span className="text-foreground min-w-0 truncate text-body-lg max-[374px]:hidden md:hidden">
      {context.item.label}
    </span>
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
          className="group bg-brand-wash hover:bg-brand/15 border-brand/25 flex h-9 min-w-0 items-center gap-2.5 rounded-full border pr-3.5 pl-3 text-left transition-colors duration-150"
          aria-label={`Job search ${percent}% — open progress`}
        >
          <span aria-hidden className="relative flex size-2 shrink-0">
            <span className="bg-chart-1 absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
            <span className="bg-chart-1 relative inline-flex size-2 rounded-full" />
          </span>
          <span className="min-w-0 truncate text-body-sm">
            <span className="text-foreground">{stage?.label ?? "Searching"}</span>
            {search.live?.detail ? (
              <span className="text-muted-foreground hidden lg:inline"> · {search.live.detail}</span>
            ) : null}
          </span>
          <span className="tabular text-brand-ink shrink-0 text-body-sm font-medium">{percent}%</span>
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
        <span className="text-muted-foreground hidden truncate text-body-sm sm:inline">
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
              <span className="text-destructive hidden min-w-0 cursor-help items-center gap-1.5 truncate text-body-sm sm:flex" />
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
          className="text-muted-foreground hover:text-foreground hidden min-w-0 items-center gap-2 truncate rounded-md text-body-sm transition-colors duration-150 sm:flex"
        >
          {outcome ? (
            <span className="truncate">
              <span className="text-foreground">{outcome.strong} strong</span>
              {" · "}
              {outcome.worth} worth a look
            </span>
          ) : status.toReview > 0 ? (
            <span className="truncate">
              <span className="tabular text-foreground">{status.toReview}</span> to review
            </span>
          ) : (
            <span className="truncate">Shortlist reviewed</span>
          )}
          {ago ? <span className="text-muted-foreground shrink-0">· searched {ago}</span> : null}
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
              "inline-flex h-9 cursor-help items-center gap-2 rounded-full border px-3 text-body-sm",
              tone === "critical" && "bg-destructive-wash border-destructive/20 text-destructive",
              tone === "warn" && "bg-warn-wash border-warn/20 text-warn",
              tone === "ok" && "bg-card border-border text-muted-foreground",
            )}
          />
        }
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tone === "critical" && "bg-destructive",
            tone === "warn" && "bg-warn-fill",
            tone === "ok" && "bg-chart-1",
          )}
        />
        <span className="hidden sm:inline">AI</span>
        <span className="tabular text-foreground">
          <span className="font-medium">${budget.spentUsd.toFixed(0)}</span>
          <span className="text-muted-foreground max-sm:hidden"> / ${budget.budgetUsd}</span>
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
              className="bg-brand-wash text-brand-ink hover:border-brand/40 grid size-9 place-items-center rounded-full border border-brand/20 text-caption font-medium transition-colors duration-150"
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
 * Floating 64px white bar (20px radius) beside the dark sidebar panel.
 * The page H1 lives in PageHeader;
 * the topbar carries page context, the always-available job search (the one
 * dark action), AI budget, account and — below lg — the round nav toggle.
 */
export function AppTopbar({
  budget,
  userEmail,
  userName,
  searchStatus,
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
  isOwner = false,
}: {
  /** Owner only — other accounts don't manage the AI bill. */
  budget?: BudgetMeter;
  userEmail?: string;
  userName?: string | null;
  searchStatus: JobSearchStatus;
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
  isOwner?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const { running, live } = useJobSearch();
  const percent = Math.max(0, Math.min(100, live?.percent ?? 0));
  const scrolled = useScrolledPast(100);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="bg-card/95 shadow-card sticky top-3 z-30 mx-3 mt-3 flex h-16 shrink-0 items-center gap-3 rounded-card px-3 backdrop-blur-xl transition-shadow duration-250 ease-standard data-scrolled:shadow-[0_8px_24px_rgb(16_24_40/0.10)] sm:gap-4 sm:px-4 lg:px-5"
    >
      <div className="flex min-w-0 shrink items-center gap-2">
        <OptraLogo href="/" width={72} className="lg:hidden" />
        <PageContext />
        <MobilePageTitle />
      </div>

      <div className="flex min-w-0 flex-1 justify-end md:justify-center">
        <JobSearchControl status={searchStatus} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {budget ? <BudgetPill budget={budget} /> : null}
        {userEmail ? (
          <div className="lg:hidden">
            <AccountMenu email={userEmail} />
          </div>
        ) : null}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <button
            type="button"
            className="bg-subtle text-foreground hover:bg-primary hover:text-primary-foreground grid size-11 place-items-center rounded-full transition-colors duration-150 ease-standard lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
          >
            <Menu className="size-5" />
          </button>
          <SheetContent side="right" className="dark bg-sidebar gap-0 p-0 pt-2">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebarNav
              queueCount={queueCount}
              interestedCount={interestedCount}
              profileFitCount={profileFitCount}
              isOwner={isOwner}
              userName={userName}
              userEmail={userEmail}
              onNavigate={() => setNavOpen(false)}
              className="h-full w-full"
            />
          </SheetContent>
        </Sheet>
      </div>

      {running ? (
        <div
          aria-hidden
          className="bg-brand/15 absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full"
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
