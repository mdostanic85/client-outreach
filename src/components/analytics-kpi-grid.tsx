"use client";

import { Stagger, StaggerItem } from "@/components/motion";
import { Surface } from "@/components/page-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    { label: "Companies", value: String(totalLeads), tooltip: null },
    { label: "Sent", value: String(sent), tooltip: null },
    { label: "Replies", value: String(replies), tooltip: null },
    {
      label: "Reply rate",
      value: `${(replyRate * 100).toFixed(0)}%`,
      tooltip:
        "Replies divided by emails sent. Small samples swing wildly.",
    },
  ];

  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k, index) => (
        <StaggerItem key={k.label} index={index}>
          <Surface interactive className="px-5 py-5">
            {k.tooltip ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <p className="text-muted-foreground w-fit cursor-help text-[14px] font-medium tracking-wide uppercase">
                      {k.label}
                    </p>
                  }
                />
                <TooltipContent className="max-w-xs text-left leading-relaxed">
                  {k.tooltip}
                </TooltipContent>
              </Tooltip>
            ) : (
              <p className="text-muted-foreground text-[14px] font-medium tracking-wide uppercase">
                {k.label}
              </p>
            )}
            <p className="tabular mt-2 text-[28px] font-medium tracking-tight text-foreground">
              {k.value}
            </p>
          </Surface>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
