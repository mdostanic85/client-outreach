import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MarketFitReport } from "@/modules/profile/market-fit";

/**
 * Up to three concrete profile fixes, plus what matched roles keep asking for.
 * Replaces the old Market fit score so Profile shows a single score (the CV).
 */
export function WorthImproving({ report }: { report: MarketFitReport }) {
  // Market gaps are also copied into `actions`. Show them once, in the list below.
  const actions = report.actions
    .filter((a) => !a.done && !a.id.startsWith("market:"))
    .slice(0, 3);
  const gaps = report.marketGaps.slice(0, 3);
  if (actions.length === 0 && gaps.length === 0) return null;

  return (
    <section className="border-border bg-card/40 mb-10 rounded-2xl border p-5">
      <p className="text-muted-foreground text-[13px] font-medium tracking-[0.12em] uppercase">
        Worth improving
      </p>
      {actions.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {actions.map((action) => (
            <li key={action.id}>
              <Link
                href={`/profile?fix=${action.fix}`}
                className="hover:bg-muted/30 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-[var(--card-foreground)]">
                    {action.label}
                  </span>
                  {action.detail ? (
                    <span className="text-muted-foreground mt-0.5 block text-[14px]">
                      {action.detail}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {gaps.length ? (
        <div className="border-border mt-4 border-t pt-4">
          <p className="text-[14px] font-medium">Roles you matched keep asking for</p>
          <ul className="text-muted-foreground mt-2 space-y-1 text-[14px]">
            {gaps.map((gap) => (
              <li key={gap.text}>
                {gap.text}{" "}
                <span className="tabular-nums">
                  ({gap.count} of {gap.matchTotal})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
