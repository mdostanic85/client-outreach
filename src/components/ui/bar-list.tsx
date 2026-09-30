import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BarListItem = {
  key: string;
  label: ReactNode;
  value: number;
  /** Text shown at the end of the row; defaults to the value. */
  display?: ReactNode;
};

/**
 * Ranked horizontal bars for comparing magnitudes (one measure, one series).
 * Single verdigris hue on a subtle track, 4px rounded ends, labels and values
 * in ink — the rows double as the table view.
 */
export function BarList({
  items,
  max,
  className,
}: {
  items: BarListItem[];
  /** Scale maximum; defaults to the largest value. */
  max?: number;
  className?: string;
}) {
  const top = max ?? Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => {
        const pct = Math.max(0, Math.min(100, (item.value / top) * 100));
        return (
          <li
            key={item.key}
            className="interactive-row grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-tile px-2 py-2 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:gap-4"
          >
            <span className="text-foreground truncate text-body-sm">{item.label}</span>
            <span aria-hidden className="bg-subtle h-2 overflow-hidden rounded-full">
              <span
                className="bg-chart-1 block h-full rounded-full"
                style={{ width: `${pct}%`, minWidth: item.value > 0 ? "4px" : 0 }}
              />
            </span>
            <span className="tabular text-foreground min-w-10 text-right text-body-sm">
              {item.display ?? item.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
