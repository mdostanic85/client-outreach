"use client";

import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { AppSidebarNav } from "@/components/app-sidebar";
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
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/auth/actions";
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
 * Topbar utilities only — Linear-style quiet chrome.
 * Page H1 lives in PageHeader; no duplicate titles here.
 */
export function AppTopbar({
  budget,
  userEmail,
  leadsCount = 0,
  queueCount = 0,
  interestedCount = 0,
}: {
  budget?: BudgetMeter;
  userEmail?: string;
  leadsCount?: number;
  queueCount?: number;
  interestedCount?: number;
}) {
  const [navOpen, setNavOpen] = useState(false);

  const ratio =
    budget && budget.budgetUsd > 0
      ? budget.spentUsd / budget.budgetUsd
      : 0;
  const budgetTone = budget?.hardStopped
    ? "critical"
    : ratio >= 0.75
      ? "warn"
      : "ok";

  const budgetTip = budget?.hardStopped
    ? `AI budget hard-stopped. Spent $${budget.spentUsd.toFixed(0)} of $${budget.budgetUsd}. New AI calls are blocked until next month or you raise the limit in Admin.`
    : budget
      ? `Estimated LLM spend this month: $${budget.spentUsd.toFixed(0)} of $${budget.budgetUsd}.${budget.alert ? ` ${budget.alert}` : ""} Hard stop blocks new AI calls when reached.`
      : "";

  return (
    <header className="border-border/80 bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 backdrop-blur-xl sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
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
              leadsCount={leadsCount}
              queueCount={queueCount}
              interestedCount={interestedCount}
              onNavigate={() => setNavOpen(false)}
              className="h-full w-full border-0"
            />
          </SheetContent>
        </Sheet>
        <p className="text-muted-foreground truncate text-[13px] lg:hidden">
          Optra
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {budget ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  className={cn(
                    "inline-flex h-8 cursor-help items-center gap-2 rounded-full px-2.5 text-[13px]",
                    budgetTone === "critical" &&
                      "bg-destructive/12 text-destructive",
                    budgetTone === "warn" &&
                      "bg-[color-mix(in_oklab,var(--warn)_14%,transparent)] text-[var(--warn)]",
                    budgetTone === "ok" && "bg-secondary text-muted-foreground",
                  )}
                />
              }
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  budgetTone === "critical" && "bg-destructive",
                  budgetTone === "warn" && "bg-[var(--warn)]",
                  budgetTone === "ok" && "bg-[var(--success)]",
                )}
              />
              <span className="hidden font-medium tracking-wide uppercase sm:inline">
                AI
              </span>
              <span className="tabular text-[var(--card-foreground)]">
                <span className="font-medium">
                  ${budget.spentUsd.toFixed(0)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  / ${budget.budgetUsd}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left leading-relaxed">
              {budgetTip}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {userEmail ? (
          <>
            <span
              aria-hidden
              className="bg-border mx-1 hidden h-5 w-px sm:block"
            />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="bg-primary/18 text-primary grid size-8 cursor-default place-items-center rounded-full text-[12px] font-semibold tracking-wide ring-1 ring-[color-mix(in_oklab,var(--primary)_35%,transparent)]" />
                  }
                >
                  {initials(userEmail)}
                </TooltipTrigger>
                <TooltipContent>{userEmail}</TooltipContent>
              </Tooltip>
              <span className="text-muted-foreground hidden max-w-[160px] truncate text-[13px] xl:inline">
                {userEmail}
              </span>
              <form action={signOutAction}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="submit"
                        className="text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex size-8 items-center justify-center rounded-full transition-colors duration-150 ease-[var(--ease-out-soft)]"
                      />
                    }
                  >
                    <LogOut className="size-3.5" />
                    <span className="sr-only">Log out</span>
                  </TooltipTrigger>
                  <TooltipContent>Log out</TooltipContent>
                </Tooltip>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
