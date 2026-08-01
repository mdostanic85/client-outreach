"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { dismissSetupChecklistAction } from "@/modules/onboarding/actions";
import type { SetupChecklistItem } from "@/modules/onboarding/state";
import { Surface } from "@/components/page-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SetupChecklistBanner({
  items,
}: {
  items: SetupChecklistItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;
  const next = items.find((i) => !i.done);
  const ring = 2 * Math.PI * 15.5;
  const progressOffset =
    ring - (items.length ? (doneCount / items.length) * ring : 0);

  if (allDone) return null;

  const focusPrimaryAction = () => {
    const el = document.getElementById("today-primary-action");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  };

  return (
    <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <div
            className="bg-muted relative h-9 w-9 shrink-0 rounded-full"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-label={`${doneCount} of ${items.length} setup steps complete`}
          >
            <svg className="size-9 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-border"
                strokeWidth="2.5"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-primary transition-all"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={progressOffset}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums text-foreground">
              {doneCount}/{items.length}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-semibold text-[var(--card-foreground)]">
              Finish setup
            </p>
            <p className="text-muted-foreground truncate text-[13px]">
              {next ? `Next: ${next.label}` : "Almost done"}
            </p>
          </div>

          <span className="text-muted-foreground hidden shrink-0 sm:inline">
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {next ? (
            next.id === "collect" ? (
              <Button type="button" size="sm" onClick={focusPrimaryAction}>
                Continue
              </Button>
            ) : (
              <Link
                href={next.href}
                className={buttonVariants({ size: "sm" })}
              >
                Continue
              </Link>
            )
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label="Dismiss setup checklist"
            onClick={() =>
              startTransition(() => {
                void dismissSetupChecklistAction();
              })
            }
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <ul className="border-border/60 divide-border/60 border-t divide-y">
          {items.map((item) => {
            const isNext = next?.id === item.id;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2.5 text-[13px] transition-colors hover:bg-muted/40",
                    item.done && "text-muted-foreground",
                    isNext && !item.done && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border text-[11px]",
                      item.done
                        ? "border-transparent bg-primary/15 text-primary"
                        : isNext
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    {item.done ? <Check className="size-3" /> : null}
                  </span>
                  <span className={cn("flex-1", item.done && "line-through")}>
                    {item.label}
                  </span>
                  {isNext ? (
                    <span className="text-primary text-[11px] font-medium">
                      Up next
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Surface>
  );
}
