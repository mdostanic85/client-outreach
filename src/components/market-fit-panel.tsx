"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PanelBody, Surface } from "@/components/page-shell";
import { cn } from "@/lib/utils";
import type {
  MarketFitFixTarget,
  MarketFitPillar,
  MarketFitReport,
} from "@/modules/profile/market-fit";

function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 65) return "text-[var(--card-foreground)]";
  if (score >= 40) return "text-amber-800 dark:text-amber-200";
  return "text-muted-foreground";
}

function progressWidth(score: number): string {
  return `${Math.max(4, Math.min(100, score))}%`;
}

function fixHref(fix: MarketFitFixTarget): string {
  return `/profile?fix=${fix}`;
}

export function MarketFitPanel({ report }: { report: MarketFitReport }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active: MarketFitPillar | null =
    report.pillars.find((p) => p.id === activeId) ?? null;

  return (
    <>
      <Surface>
        <PanelBody className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[20px] font-semibold tracking-tight text-[var(--card-foreground)]">
                  Market fit
                </h2>
                <Badge variant="secondary">{report.label}</Badge>
                {report.openHighImpactCount > 0 ? (
                  <Badge variant="outline">
                    {report.openHighImpactCount} to fix
                  </Badge>
                ) : (
                  <Badge variant="outline">All clear</Badge>
                )}
              </div>
              <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed">
                {report.summary}
              </p>
            </div>
            <div className="min-w-[120px] text-right">
              <p
                className={cn(
                  "font-display text-[34px] leading-none font-semibold tabular-nums",
                  scoreTone(report.score),
                )}
              >
                {report.score}
              </p>
              <p className="text-muted-foreground mt-1 text-[12px] font-medium tracking-wide uppercase">
                Overall
              </p>
            </div>
          </div>

          <div className="bg-muted/40 h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-300 ease-[var(--ease-emphasized)]"
              style={{ width: progressWidth(report.score) }}
            />
          </div>

          <div>
            <p className="text-muted-foreground mb-3 text-[12px] font-semibold tracking-[0.08em] uppercase">
              Build your foundation
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {report.pillars.map((pillar) => {
                const selected = activeId === pillar.id;
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => setActiveId(pillar.id)}
                    className={cn(
                      "border-border bg-muted/15 hover:bg-muted/30 group flex flex-col gap-3 rounded-2xl border px-4 py-4 text-left transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out-soft)] active:scale-[0.99]",
                      selected && "ring-primary/40 bg-muted/25 ring-2",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-medium text-[var(--card-foreground)]">
                            {pillar.label}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] tracking-wide uppercase"
                          >
                            {pillar.impact} impact
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[13px]">
                          {pillar.summary}
                        </p>
                      </div>
                      <ChevronRight className="text-muted-foreground group-hover:text-foreground mt-0.5 size-4 shrink-0 transition-colors" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-muted/50 h-1.5 flex-1 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            pillar.score >= 100 ? "bg-emerald-600" : "bg-primary",
                          )}
                          style={{ width: progressWidth(pillar.score) }}
                        />
                      </div>
                      <span
                        className={cn(
                          "tabular-nums text-[13px] font-semibold",
                          scoreTone(pillar.score),
                        )}
                      >
                        {pillar.score}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {report.actions.filter((a) => !a.done).slice(0, 3).length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-3 text-[12px] font-semibold tracking-[0.08em] uppercase">
                Suggested for you
              </p>
              <ul className="space-y-2">
                {report.actions
                  .filter((a) => !a.done)
                  .slice(0, 3)
                  .map((action) => (
                    <li key={action.id}>
                      <Link
                        href={fixHref(action.fix)}
                        className="border-border hover:bg-muted/30 flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-[var(--card-foreground)]">
                            {action.label}
                          </p>
                          {action.detail ? (
                            <p className="text-muted-foreground mt-0.5 text-[13px]">
                              {action.detail}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant="outline" className="shrink-0 capitalize">
                          {action.impact}
                        </Badge>
                        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {report.matchSampleSize > 0 ? (
            <p className="text-muted-foreground text-[12px]">
              Market gaps from {report.matchSampleSize} recent job match
              {report.matchSampleSize === 1 ? "" : "es"}.
            </p>
          ) : (
            <p className="text-muted-foreground text-[12px]">
              Score some jobs on Today to unlock market demand gaps.
            </p>
          )}
        </PanelBody>
      </Surface>

      <Sheet
        open={active != null}
        onOpenChange={(open) => {
          if (!open) setActiveId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-md"
          showCloseButton
        >
          {active ? (
            <>
              <SheetHeader className="border-b">
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <SheetTitle className="text-[18px] leading-snug">
                    {active.label}
                  </SheetTitle>
                  <Badge
                    variant="outline"
                    className="text-[10px] tracking-wide uppercase"
                  >
                    {active.impact} impact
                  </Badge>
                </div>
                <SheetDescription>
                  {active.score}% · {active.summary}
                </SheetDescription>
                <div className="bg-muted/50 mt-3 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: progressWidth(active.score) }}
                  />
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
                <p className="text-muted-foreground text-[14px] leading-relaxed">
                  {active.description}
                </p>
                <ul className="space-y-2">
                  {active.checklist.map((item) => (
                    <li
                      key={item.id}
                      className="border-border flex gap-3 rounded-xl border px-3.5 py-3"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                          item.done
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.done ? (
                          <Check className="size-3" strokeWidth={3} />
                        ) : (
                          <span className="size-1.5 rounded-full bg-current" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[var(--card-foreground)]">
                          {item.label}
                        </p>
                        {item.detail ? (
                          <p className="text-muted-foreground mt-0.5 text-[13px]">
                            {item.detail}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <SheetFooter className="border-t">
                <Link
                  href={fixHref(active.cta.fix)}
                  onClick={() => setActiveId(null)}
                  className={cn(buttonVariants(), "w-full")}
                >
                  {active.cta.label}
                </Link>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
