"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  generateWeeklyJobInsightsAction,
  proposeSearchStrategyAction,
  reactivateSearchStrategyAction,
  setAdaptiveJobRankingAction,
  setJobOutcomeAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { ProposalActions } from "@/components/learning-controls";
import { PanelBody, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { JobLearningDashboard } from "@/modules/learning/queries";
import { cn } from "@/lib/utils";

const OUTCOMES = [
  { value: "none", label: "Pending" },
  { value: "recruiter_response", label: "Reply" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "no_response", label: "No response" },
] as const;

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function deltaLabel(n: number | null) {
  if (n == null) return null;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}pp`;
}

function proposalVersion(json: string) {
  try {
    const p = JSON.parse(json) as { toVersion?: number };
    return p.toVersion ?? "?";
  } catch {
    return "?";
  }
}

export function JobLearningHub({ dash }: { dash: JobLearningDashboard }) {
  const router = useRouter();
  const [tab, setTab] = useState<"insights" | "proposals" | "strategies">(
    "insights",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else router.refresh();
    });
  };

  const force = !dash.gates.ready;
  const kpis = dash.kpis;
  const pendingCount = dash.pendingStrategyProposals.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-muted/50 border-border inline-flex rounded-xl border p-1">
          {(
            [
              ["insights", "Results"],
              [
                "proposals",
                `Suggested${pendingCount ? ` (${pendingCount})` : ""}`,
              ],
              ["strategies", "Versions"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[15px] font-medium transition-colors",
                tab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dash.activeStrategyVersion != null ? (
            <Badge variant="secondary">v{dash.activeStrategyVersion}</Badge>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  variant={dash.gates.ready ? "secondary" : "outline"}
                  className="cursor-help"
                />
              }
            >
              {dash.gates.ready ? "Ready" : "Gathering"}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left leading-relaxed">
              Optra waits for enough outcomes before suggesting search or ranking
              changes, so recommendations aren&apos;t random.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="xs"
                  variant={dash.adaptiveRanking ? "secondary" : "outline"}
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setAdaptiveJobRankingAction(!dash.adaptiveRanking),
                    )
                  }
                />
              }
            >
              Adaptive {dash.adaptiveRanking ? "on" : "off"}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left leading-relaxed">
              When on, recent outcomes gently re-order job results. You still
              approve search-criteria changes.
            </TooltipContent>
          </Tooltip>
          {tab === "insights" ? (
            <Button
              size="xs"
              disabled={pending}
              onClick={() => run(() => generateWeeklyJobInsightsAction(force))}
            >
              Generate
            </Button>
          ) : null}
          {tab === "proposals" ? (
            <Button
              size="xs"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => proposeSearchStrategyAction(force))}
            >
              Suggest update
            </Button>
          ) : null}
          <Link
            href="/search-criteria"
            className="text-muted-foreground text-[14px] underline-offset-4 hover:underline"
          >
            Criteria
          </Link>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-[15px]">{error}</p>
      ) : null}

      {tab === "insights" ? (
        <div className="space-y-4">
          {kpis ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: "Interview",
                  value: pct(kpis.interviewRate),
                  hint: deltaLabel(kpis.vsPreviousInterviewDelta),
                },
                {
                  label: "Response",
                  value: pct(kpis.responseRate),
                  hint: null,
                },
                {
                  label: "Offer",
                  value: pct(kpis.offerRate),
                  hint: null,
                },
                {
                  label: "Apps / interview",
                  value:
                    kpis.appsPerInterview != null
                      ? kpis.appsPerInterview.toFixed(1)
                      : "—",
                  hint: `${kpis.applicationsN} apps`,
                },
              ].map((card) => (
                <Surface key={card.label} className="px-4 py-3">
                  <p className="text-muted-foreground text-[14px] font-medium tracking-wide uppercase">
                    {card.label}
                  </p>
                  <p className="font-display tabular mt-1 text-[22px] font-semibold tracking-tight">
                    {card.value}
                  </p>
                  {card.hint ? (
                    <p className="text-muted-foreground mt-0.5 text-[14px]">
                      {card.hint}
                    </p>
                  ) : null}
                </Surface>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-5">
            <Surface className="lg:col-span-2">
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <p className="font-display text-[14px] font-semibold tracking-tight">
                  What worked
                </p>
                <span className="text-muted-foreground text-[14px]">
                  {dash.gates.cycleProgress.current}/
                  {dash.gates.cycleProgress.target} cycle
                </span>
              </div>
              {dash.latestInsights.length === 0 &&
              dash.weeklyReports.length === 0 ? (
                <EmptyState
                  className="py-8 sm:py-10"
                  title="Nothing yet"
                  description="Log replies below, then hit Generate."
                />
              ) : (
                <PanelBody className="space-y-3 px-4 py-4">
                  {dash.latestInsights.length > 0 ? (
                    <ul className="space-y-1.5 text-[15px] leading-snug">
                      {dash.latestInsights.slice(0, 5).map((insight) => (
                        <li key={insight} className="flex gap-2">
                          <span className="text-muted-foreground mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {dash.weeklyReports[0] ? (
                    <p className="text-muted-foreground line-clamp-4 text-[14px] leading-relaxed">
                      {dash.weeklyReports[0].bodyMd}
                    </p>
                  ) : null}
                  {dash.pendingStrategyProposals[0] ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setTab("proposals")}
                    >
                      Review v
                      {proposalVersion(
                        dash.pendingStrategyProposals[0].proposalJson,
                      )}
                    </Button>
                  ) : null}
                </PanelBody>
              )}
            </Surface>

            <Surface className="lg:col-span-3">
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <p className="font-display text-[14px] font-semibold tracking-tight">
                  After you applied
                </p>
                <span className="text-muted-foreground tabular text-[14px]">
                  {dash.appliedJobs.length}
                </span>
              </div>
              {dash.appliedJobs.length === 0 ? (
                <EmptyState
                  className="py-8 sm:py-10"
                  title="No applications yet"
                  description="Mark a job as applied on Today, then set the outcome here."
                  actionLabel="Today"
                  actionHref="/"
                />
              ) : (
                <div className="divide-border max-h-[28rem] divide-y overflow-y-auto">
                  {dash.appliedJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">
                          {job.title}
                        </p>
                        {job.searchProfileVersion != null ? (
                          <p className="text-muted-foreground text-[14px]">
                            v{job.searchProfileVersion}
                          </p>
                        ) : null}
                      </div>
                      <select
                        className="border-border bg-background h-8 max-w-[9.5rem] shrink-0 rounded-lg border px-2 text-[14px]"
                        disabled={pending}
                        value={job.outcome === "none" ? "none" : job.outcome}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "none") return;
                          run(() =>
                            setJobOutcomeAction(
                              job.id,
                              v as
                                | "no_response"
                                | "recruiter_response"
                                | "interview"
                                | "rejected"
                                | "offer"
                                | "accepted",
                            ),
                          );
                        }}
                      >
                        {OUTCOMES.map((o) => (
                          <option
                            key={o.value}
                            value={o.value}
                            disabled={o.value === "none"}
                          >
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        </div>
      ) : null}

      {tab === "proposals" ? (
        <Surface>
          {dash.pendingStrategyProposals.length === 0 ? (
            <EmptyState
              className="py-10 sm:py-12"
              title="No suggested changes"
              description="Once you have enough replies, Optra will propose search updates here."
            />
          ) : (
            <div className="divide-border divide-y">
              {dash.pendingStrategyProposals.map((p) => {
                let changes: string[] = [];
                try {
                  const data = JSON.parse(p.proposalJson) as {
                    changes?: string[];
                  };
                  changes = data.changes ?? [];
                } catch {
                  /* ignore */
                }
                return (
                  <div key={p.id} className="space-y-3 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{p.kind}</Badge>
                      <span className="font-display text-[14px] font-semibold">
                        {p.title}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[15px] leading-snug">
                      {p.summary}
                    </p>
                    {changes.length > 0 ? (
                      <ul className="text-muted-foreground space-y-1 text-[14px]">
                        {changes.slice(0, 5).map((c) => (
                          <li key={c} className="flex gap-2">
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current opacity-50" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <ProposalActions proposalId={p.id} />
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      ) : null}

      {tab === "strategies" ? (
        <Surface>
          {dash.strategies.length === 0 ? (
            <EmptyState
              className="py-10 sm:py-12"
              title="No versions yet"
              description="Approve search criteria to create version 1."
              actionLabel="Criteria"
              actionHref="/search-criteria"
            />
          ) : (
            <div className="overflow-x-auto px-4 py-2 sm:px-5">
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="text-muted-foreground border-b text-[14px]">
                    <th className="py-2.5 pr-3 font-medium">Ver</th>
                    <th className="py-2.5 pr-3 font-medium">Apps</th>
                    <th className="py-2.5 pr-3 font-medium">Int%</th>
                    <th className="py-2.5 pr-3 font-medium">Rsp%</th>
                    <th className="py-2.5 pr-3 font-medium">Conf</th>
                    <th className="py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {dash.strategies.map((s) => (
                    <tr
                      key={s.strategyVersion}
                      className="border-border border-b last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-medium">
                        v{s.strategyVersion}
                        {s.status === "approved" ? (
                          <Badge className="ml-1.5" variant="secondary">
                            Active
                          </Badge>
                        ) : null}
                      </td>
                      <td className="tabular py-2.5 pr-3">
                        {s.applicationsN}
                      </td>
                      <td className="tabular py-2.5 pr-3">
                        {pct(s.interviewRate)}
                      </td>
                      <td className="tabular py-2.5 pr-3">
                        {pct(s.responseRate)}
                      </td>
                      <td className="py-2.5 pr-3">{s.confidence}</td>
                      <td className="py-2.5 text-right">
                        {s.status !== "approved" ? (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                reactivateSearchStrategyAction(
                                  s.strategyVersion,
                                ),
                              )
                            }
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-[14px]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      ) : null}
    </div>
  );
}
