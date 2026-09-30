"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LearningControls, ProposalActions } from "@/components/learning-controls";
import { Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Proposal = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  proposalJson: string;
  status: string;
};

type Report = {
  id: string;
  kind: string;
  title: string;
  bodyMd: string;
};

type SourceRow = {
  source: string;
  signals: number;
  leads: number;
  acceptRate: number;
  replyRate: number;
};

type Gates = {
  ready: boolean;
  daysOfSignals: number;
  editedDrafts: number;
  deliveredMessages: number;
  missing: string[];
};

export function ClientsLearningHub({
  gates,
  sourceRows,
  proposals,
  reports,
}: {
  gates: Gates;
  sourceRows: SourceRow[];
  proposals: Proposal[];
  reports: Report[];
}) {
  const [tab, setTab] = useState<"sources" | "proposals" | "reports">(
    proposals.length > 0 ? "proposals" : "sources",
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-subtle inline-flex gap-0.5 rounded-full p-1">
          {(
            [
              ["sources", "Sources"],
              [
                "proposals",
                `Suggested${proposals.length ? ` (${proposals.length})` : ""}`,
              ],
              ["reports", "Reports"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "h-9 rounded-full px-4 text-body-sm font-medium transition-colors duration-150 ease-standard",
                tab === id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  variant={gates.ready ? "secondary" : "outline"}
                  className="cursor-help"
                />
              }
            >
              {gates.ready ? "Ready" : "Gathering"}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left leading-relaxed">
              Optra waits for enough sent mail and edits before suggesting style
              changes, so recommendations aren&apos;t random.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={<Badge variant="outline" className="cursor-help" />}
            >
              days {gates.daysOfSignals}/30
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left leading-relaxed">
              Days with outreach activity toward the suggestion threshold.
            </TooltipContent>
          </Tooltip>
          <Badge variant="outline">edits {gates.editedDrafts}/20</Badge>
          <Badge variant="outline">sent {gates.deliveredMessages}/50</Badge>
        </div>
      </div>

      {tab === "sources" ? (
        <div className="space-y-4">
          <LearningControls gatesReady={gates.ready} />
          <Surface>
            {sourceRows.length === 0 ? (
              <EmptyState
                className="py-10 sm:py-12"
                title="No sources yet"
                description="Accept and send outreach to see rates."
                actionLabel="Today"
                actionHref="/"
              />
            ) : (
              <div className="overflow-x-auto px-4 py-2 sm:px-5">
                <table className="w-full text-left text-body">
                  <thead>
                    <tr className="text-muted-foreground border-b text-body-sm">
                      <th className="py-2.5 pr-3 font-medium">Source</th>
                      <th className="py-2.5 pr-3 font-medium">Sig</th>
                      <th className="py-2.5 pr-3 font-medium">Leads</th>
                      <th className="py-2.5 pr-3 font-medium">Acc%</th>
                      <th className="py-2.5 font-medium">Reply%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRows.map((r) => (
                      <tr
                        key={r.source}
                        className="border-border border-b last:border-0"
                      >
                        <td className="py-2.5 pr-3 font-medium">{r.source}</td>
                        <td className="tabular py-2.5 pr-3">{r.signals}</td>
                        <td className="tabular py-2.5 pr-3">{r.leads}</td>
                        <td className="tabular py-2.5 pr-3">
                          {(r.acceptRate * 100).toFixed(0)}%
                        </td>
                        <td className="tabular py-2.5">
                          {(r.replyRate * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>
        </div>
      ) : null}

      {tab === "proposals" ? (
        <Surface>
          {proposals.length === 0 ? (
            <EmptyState
              className="py-10 sm:py-12"
              title="No suggested changes"
              description="When there is enough outreach data, updates to approve show up here."
              actionLabel="Queue"
              actionHref="/queue"
            />
          ) : (
            <div className="divide-border divide-y">
              {proposals.map((p) => (
                <div key={p.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{p.kind}</Badge>
                    <span className="text-body-sm font-medium">
                      {p.title}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-body leading-snug">
                    {p.summary}
                  </p>
                  <ProposalActions proposalId={p.id} />
                </div>
              ))}
            </div>
          )}
        </Surface>
      ) : null}

      {tab === "reports" ? (
        <Surface>
          {reports.length === 0 ? (
            <EmptyState
              className="py-10 sm:py-12"
              title="No reports"
              description="Generate from Sources tab."
            />
          ) : (
            <div className="divide-border max-h-[32rem] divide-y overflow-y-auto">
              {reports.map((r) => (
                <div key={r.id} className="space-y-2 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{r.kind}</Badge>
                    <span className="text-body-sm font-medium">
                      {r.title}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-6 whitespace-pre-wrap text-body-sm leading-relaxed">
                    {r.bodyMd}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Surface>
      ) : null}
    </div>
  );
}
