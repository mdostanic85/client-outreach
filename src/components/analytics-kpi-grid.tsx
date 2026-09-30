"use client";

import { Info } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { CountUp } from "@/components/ui/value-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Four headline numbers as stat tiles in the 12-column grid. Each number
 * counts up once on first view (skipped under reduced motion).
 */
export function AnalyticsKpiGrid({
  totalLeads,
  sent,
  replies,
  replyRate,
}: {
  totalLeads: number;
  sent: number;
  replies: number;
  replyRate: number;
}) {
  const kpis = [
    { label: "Companies", value: totalLeads, format: undefined, tooltip: null },
    { label: "Sent", value: sent, format: undefined, tooltip: null },
    { label: "Replies", value: replies, format: undefined, tooltip: null },
    {
      label: "Reply rate",
      value: replyRate * 100,
      format: (n: number) => `${n.toFixed(0)}%`,
      tooltip: "Replies divided by emails sent. Small samples swing wildly.",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
      {kpis.map((k) => (
        <StatTile
          key={k.label}
          surface="card"
          className="md:col-span-3"
          label={
            k.tooltip ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex cursor-help items-center gap-1 rounded-md"
                    />
                  }
                >
                  {k.label}
                  <Info className="size-3" aria-hidden />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left">{k.tooltip}</TooltipContent>
              </Tooltip>
            ) : (
              k.label
            )
          }
          value={<CountUp value={k.value} format={k.format} />}
        />
      ))}
    </div>
  );
}
