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
                ? "bg-brand text-primary-foreground shadow-sm"
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

/** Labeled mode switch used on Today / Improve (Jobs | Companies). Figma 3:173 */
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
        "grid max-w-[576px] grid-cols-2 gap-1 rounded-[18px] bg-[rgba(28,33,44,0.5)] p-1",
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
              "segment-option flex flex-col items-start justify-center rounded-[14px] px-3.5 py-2.5 text-left transition-colors",
              selected
                ? "bg-brand text-primary-foreground shadow-[0_1px_1.5px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.1)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              disabled && !selected && "opacity-50",
            )}
          >
            <span className="flex items-center gap-1 text-[18px] leading-[23px] font-medium">
              {option.label}
              {option.count != null ? (
                <span className="font-mono tabular">{option.count}</span>
              ) : null}
            </span>
            <span
              className={cn(
                "mt-0.5 block text-[13px] leading-[18px]",
                selected
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground/80",
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
