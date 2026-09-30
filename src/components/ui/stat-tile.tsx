import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Stat tile: 12px radius, 16px padding, a 12px label at secondary ink over a
 * number. Sits on a white card (subtle tint) or on the page (white) — pass
 * `surface` to pick. Wrap the value in `CountUp` for a one-time counter.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  surface = "subtle",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  surface?: "subtle" | "card";
  className?: string;
}) {
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-tile p-4",
        surface === "subtle" ? "bg-subtle" : "bg-card shadow-card",
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-2 text-caption">
        {icon ? (
          <span aria-hidden className="[&_svg]:size-3.5">
            {icon}
          </span>
        ) : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="tabular text-h4 text-foreground">{value}</div>
      {hint ? (
        <div className="text-muted-foreground text-caption">{hint}</div>
      ) : null}
    </div>
  );
}
