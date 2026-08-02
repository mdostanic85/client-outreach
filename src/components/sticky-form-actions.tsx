"use client";

import { cn } from "@/lib/utils";

/**
 * Sticky footer for long forms — Clerk / Chatbase / Etsy unsaved-changes pattern.
 */
export function StickyFormActions({
  children,
  visible = true,
  className,
  message,
}: {
  children: React.ReactNode;
  visible?: boolean;
  className?: string;
  message?: React.ReactNode;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "border-border bg-background/90 sticky bottom-0 z-20 -mx-4 mt-8 border-t px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {message ? (
          <p className="text-muted-foreground text-[14px]">{message}</p>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </div>
    </div>
  );
}
