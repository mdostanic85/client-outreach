"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
  description?: string;
};

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
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        "bg-muted/50 border-border inline-flex flex-wrap rounded-xl border p-1",
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
              "segment-option rounded-lg font-medium",
              size === "sm"
                ? "px-3 py-1.5 text-[14px]"
                : "px-3.5 py-2 text-[15px]",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              disabled && "opacity-50",
            )}
          >
            {option.label}
            {option.count != null ? (
              <span className="ml-1.5 tabular opacity-80">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
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
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      title={disabled ? disabledHint : undefined}
      className={cn(
        "bg-muted/50 border-border grid max-w-xl grid-cols-2 gap-1 rounded-xl border p-1",
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
              "segment-option rounded-lg px-3.5 py-2.5 text-left",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              disabled && !selected && "opacity-50",
            )}
          >
            <span className="flex items-baseline gap-1.5 text-[15px] font-medium">
              {option.label}
              {option.count != null && option.count > 0 ? (
                <span className="tabular opacity-80">{option.count}</span>
              ) : null}
            </span>
            <span
              className={cn(
                "mt-0.5 block text-[13px] leading-snug",
                selected
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
