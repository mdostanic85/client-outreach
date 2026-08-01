"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { dismissSetupChecklistAction } from "@/modules/onboarding/actions";
import type { SetupChecklistItem } from "@/modules/onboarding/state";
import { Surface } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SetupChecklistBanner({
  items,
}: {
  items: SetupChecklistItem[];
}) {
  const [pending, startTransition] = useTransition();
  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;
  const next = items.find((i) => !i.done);

  if (allDone) return null;

  return (
    <Surface className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div>
          <p className="font-display text-[15px] font-semibold text-[var(--card-foreground)]">
            Finish setup
          </p>
          <p className="text-muted-foreground mt-0.5 text-[13px]">
            {doneCount}/{items.length} complete
            {next ? ` · Next: ${next.label}` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="bg-muted h-1.5 w-28 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={items.length}
          >
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
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
      <ul className="divide-border/60 divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-5 py-3 text-[14px] transition-colors hover:bg-muted/40",
                item.done && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[11px]",
                  item.done
                    ? "border-transparent bg-primary/15 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {item.done ? <Check className="size-3" /> : null}
              </span>
              <span className={cn(item.done && "line-through")}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
