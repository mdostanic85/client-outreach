"use client";

import { useId } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
  description?: string;
};

const INDICATOR_TRANSITION = {
  type: "tween",
  duration: 0.25,
  ease: [0.22, 1, 0.36, 1],
} as const;

/** White active surface that glides between segments (250ms layout animation). */
function ActiveIndicator({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      layoutId="segment-indicator"
      transition={reduce ? { duration: 0 } : INDICATOR_TRANSITION}
      className={cn("bg-card absolute inset-0 -z-10", className)}
    />
  );
}

/**
 * Pill track in the subtle tint with a white active segment. Used for tab
 * rows and filters (Today, Queue, Admin, package editor).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  size = "md",
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const groupId = useId();
  return (
    <LayoutGroup id={groupId}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        className={cn(
          "bg-subtle inline-flex max-w-full flex-wrap gap-0.5 rounded-full p-1 in-[.bg-subtle]:bg-card",
          className,
        )}
      >
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "relative isolate inline-flex items-center gap-1.5 rounded-full font-medium transition-colors duration-150 ease-standard",
                size === "sm"
                  ? "h-8 px-3 text-body-sm"
                  : "h-9 px-4 text-body-sm sm:text-body",
                selected
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "opacity-50",
              )}
            >
              {selected ? <ActiveIndicator className="rounded-full" /> : null}
              {option.label}
              {option.count != null ? (
                <span className="tabular text-muted-foreground">{option.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** Labeled mode switch used on Today / Improve (Jobs | Companies). */
export function ModeSwitch<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  disabledHint,
  className,
}: {
  options: Array<SegmentedOption<T> & { description: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
}) {
  const groupId = useId();
  return (
    <LayoutGroup id={groupId}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        title={disabled ? disabledHint : undefined}
        className={cn(
          "bg-subtle grid max-w-[576px] grid-cols-2 gap-1 rounded-card p-1",
          className,
        )}
      >
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "relative isolate flex flex-col items-start justify-center rounded-panel px-4 py-2.5 text-left transition-colors duration-150 ease-standard",
                selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                disabled && !selected && "opacity-50",
              )}
            >
              {selected ? <ActiveIndicator className="rounded-panel" /> : null}
              <span className="flex items-center gap-1.5 text-body-lg">
                {option.label}
                {option.count != null ? (
                  <span className="tabular text-muted-foreground">{option.count}</span>
                ) : null}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-body-sm">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
