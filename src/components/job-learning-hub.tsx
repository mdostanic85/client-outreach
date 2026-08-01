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
import { PanelBody, PanelHeader, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobLearningDashboard } from "@/modules/learning/queries";
import { cn } from "@/lib/utils";

const OUTCOMES = [
  { value: "recruiter_response", label: "Recruiter reply" },
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
  return `${sign}${(n * 100).toFixed(1)} pp`;
}

export function JobLearningHub({ dash }: { dash: JobLearningDashboard }) {
  const router = useRouter();
  const [tab, setTab] = useState<"insights" | "proposals" | "strategies">(
    "insights",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
  ) => {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else {
        setMsg("Updated");
        router.refresh();
      }
    });
  };

  const force = !dash.gates.ready;
  const kpis = dash.kpis;

  return (
    <div className="space-y-6">
      <Surface>
        <PanelHeader className="justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="font-display text-[16px] font-semibold tracking-tight">
              Adaptive job search
            </p>
            <p className="text-muted-foreground text-[13px]">
              Optimize interview rate — not application volume. Major changes
              need your approval.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dash.activeStrategyVersion != null ? (
              <Badge variant="secondary">v{dash.activeStrategyVersion}</Badge>
            ) : null}
            <Badge variant={dash.gates.ready ? "secondary" : "outline"}>
              {dash.gates.ready ? "Ready" : "Gathering data"}
            </Badge>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              triage {dash.gates.triageDecisions}/40
            </Badge>
            <Badge variant="outline">
              apps {dash.gates.applications}/15
            </Badge>
            <Badge variant="outline">
              outcomes {dash.gates.applicationsWithOutcome}
            </Badge>
            <Badge variant="outline">
              {dash.gates.cycleProgress.current}/
              {dash.gates.cycleProgress.target} cycle
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant={dash.adaptiveRanking ? "secondary" : "outline"}
              disabled={pending}
              onClick={() =>
                run(() => setAdaptiveJobRankingAction(!dash.adaptiveRanking))
              }
            >
              Adaptive ranking {dash.adaptiveRanking ? "on" : "off"}
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => generateWeeklyJobInsightsAction(force))}
            >
              Generate weekly insights
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => proposeSearchStrategyAction(force))}
            >
              Propose strategy update
            </Button>
            <Link
              href="/search-criteria"
              className="text-muted-foreground text-[13px] underline-offset-4 hover:underline"
            >
              Edit search criteria
            </Link>
          </div>
          {force ? (
            <p className="text-muted-foreground text-[12px]">
              Gates not met — actions run as preview (force).
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-[13px]">{error}</p>
          ) : null}
          {msg ? (
            <p className="text-muted-foreground text-[12px]">{msg}</p>
          ) : null}
        </PanelBody>
      </Surface>

      <div className="flex gap-1 border-b">
        {(
          [
            ["insights", "Insights"],
            ["proposals", "Proposals"],
            ["strategies", "Strategies"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "px-4 py-2 text-[14px] font-medium transition-colors",
              tab === id
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {id === "proposals" && dash.pendingStrategyProposals.length > 0
              ? ` (${dash.pendingStrategyProposals.length})`
              : ""}
          </button>
        ))}
      </div>

      {tab === "insights" ? (
        <div className="space-y-6">
          {kpis ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Interview rate",
                  value: pct(kpis.interviewRate),
                  hint: deltaLabel(kpis.vsPreviousInterviewDelta),
                },
                {
                  label: "Response rate",
                  value: pct(kpis.responseRate),
                  hint: null,
                },
                {
                  label: "Offer rate",
                  value: pct(kpis.offerRate),
                  hint: null,
                },
                {
                  label: "Apps / interview",
                  value:
                    kpis.appsPerInterview != null
                      ? kpis.appsPerInterview.toFixed(1)
                      : "—",
                  hint: `${kpis.applicationsN} apps · ${kpis.confidence}`,
                },
              ].map((card) => (
                <Surface key={card.label} className="px-4 py-4">
                  <p className="text-muted-foreground text-[12px]">
                    {card.label}
                  </p>
                  <p className="font-display mt-1 text-[22px] font-semibold tracking-tight">
                    {card.value}
                  </p>
                  {card.hint ? (
                    <p className="text-muted-foreground mt-1 text-[12px]">
                      {card.hint}
                    </p>
                  ) : null}
                </Surface>
              ))}
            </div>
          ) : null}

          <Surface>
            <PanelHeader>
              <p className="font-display text-[16px] font-semibold tracking-tight">
                This week
              </p>
            </PanelHeader>
            {dash.latestInsights.length === 0 &&
            dash.weeklyReports.length === 0 ? (
              <EmptyState
                title="No insights yet"
                description="Log application outcomes, then generate a weekly review."
              />
            ) : (
              <PanelBody className="space-y-4">
                {dash.latestInsights.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed">
                    {dash.latestInsights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                ) : null}
                {dash.weeklyReports[0] ? (
                  <pre className="text-muted-foreground whitespace-pre-wrap text-[13px] leading-relaxed">
                    {dash.weeklyReports[0].bodyMd.slice(0, 1800)}
                    {dash.weeklyReports[0].bodyMd.length > 1800 ? "…" : ""}
                  </pre>
                ) : null}
                {dash.pendingStrategyProposals[0] ? (
                  <Button
                    size="sm"
                    onClick={() => setTab("proposals")}
                  >
                    Review Strategy v
                    {(() => {
                      try {
                        const p = JSON.parse(
                          dash.pendingStrategyProposals[0]!.proposalJson,
                        ) as { toVersion?: number };
                        return p.toVersion ?? "?";
                      } catch {
                        return "?";
                      }
                    })()}{" "}
                    proposal
                  </Button>
                ) : null}
              </PanelBody>
            )}
          </Surface>

          <Surface>
            <PanelHeader>
              <p className="font-display text-[16px] font-semibold tracking-tight">
                Application outcomes
              </p>
            </PanelHeader>
            {dash.appliedJobs.length === 0 ? (
              <EmptyState
                title="No applications logged"
                description="Mark jobs as applied on Today, then record replies and interviews here."
                actionLabel="Go to Today"
                actionHref="/"
              />
            ) : (
              <div className="divide-border divide-y">
                {dash.appliedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job.title}</p>
                      <p className="text-muted-foreground text-[12px]">
                        {job.outcome === "none" ? "Pending outcome" : job.outcome}
                        {job.searchProfileVersion != null
                          ? ` · v${job.searchProfileVersion}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {OUTCOMES.map((o) => (
                        <Button
                          key={o.value}
                          size="sm"
                          variant={
                            job.outcome === o.value ? "secondary" : "outline"
                          }
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              setJobOutcomeAction(job.id, o.value),
                            )
                          }
                        >
                          {o.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      ) : null}

      {tab === "proposals" ? (
        <Surface>
          <PanelHeader className="justify-between">
            <p className="font-display text-[16px] font-semibold tracking-tight">
              Strategy proposals
            </p>
            <span className="text-muted-foreground tabular text-[13px]">
              {dash.pendingStrategyProposals.length}
            </span>
          </PanelHeader>
          {dash.pendingStrategyProposals.length === 0 ? (
            <EmptyState
              title="None pending"
              description="Generate a strategy proposal after enough outcomes exist."
            />
          ) : (
            <div className="divide-border divide-y">
              {dash.pendingStrategyProposals.map((p) => {
                let changes: string[] = [];
                try {
                  const data = JSON.parse(p.proposalJson) as {
                    changes?: string[];
                    hypothesis?: string;
                    fromVersion?: number;
                    toVersion?: number;
                  };
                  changes = data.changes ?? [];
                } catch {
                  /* ignore */
                }
                return (
                  <div
                    key={p.id}
                    className="space-y-4 px-6 py-6 sm:px-8 sm:py-7"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline">{p.kind}</Badge>
                      <span className="font-display text-[16px] font-semibold">
                        {p.title}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[14px]">
                      {p.summary}
                    </p>
                    {changes.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5 text-[13px]">
                        {changes.slice(0, 8).map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <pre className="bg-muted/50 max-h-40 overflow-auto rounded-xl p-4 text-[13px]">
                        {p.proposalJson}
                      </pre>
                    )}
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
          <PanelHeader>
            <p className="font-display text-[16px] font-semibold tracking-tight">
              Strategy versions
            </p>
          </PanelHeader>
          {dash.strategies.length === 0 ? (
            <EmptyState
              title="No strategies yet"
              description="Approve search criteria to create Strategy v1."
              actionLabel="Search criteria"
              actionHref="/search-criteria"
            />
          ) : (
            <div className="overflow-x-auto px-6 py-4 sm:px-8">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="text-muted-foreground border-b text-[12px]">
                    <th className="py-3 pr-4 font-medium">Version</th>
                    <th className="py-3 pr-4 font-medium">Apps</th>
                    <th className="py-3 pr-4 font-medium">Interview%</th>
                    <th className="py-3 pr-4 font-medium">Response%</th>
                    <th className="py-3 pr-4 font-medium">Confidence</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.strategies.map((s) => (
                    <tr
                      key={s.strategyVersion}
                      className="border-border border-b last:border-0"
                    >
                      <td className="py-4 pr-4 font-medium">
                        v{s.strategyVersion}
                        {s.status === "approved" ? (
                          <Badge className="ml-2" variant="secondary">
                            Active
                          </Badge>
                        ) : null}
                      </td>
                      <td className="tabular py-4 pr-4">{s.applicationsN}</td>
                      <td className="tabular py-4 pr-4">
                        {pct(s.interviewRate)}
                      </td>
                      <td className="tabular py-4 pr-4">
                        {pct(s.responseRate)}
                      </td>
                      <td className="py-4 pr-4">{s.confidence}</td>
                      <td className="py-4">
                        {s.status !== "approved" ? (
                          <Button
                            size="sm"
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
                          <span className="text-muted-foreground text-[12px]">
                            {s.hypothesisMd?.slice(0, 60) ?? "—"}
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
