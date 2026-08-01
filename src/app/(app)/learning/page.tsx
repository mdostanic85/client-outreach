import { JobLearningHub } from "@/components/job-learning-hub";
import { LearningControls, ProposalActions } from "@/components/learning-controls";
import { EmptyState } from "@/components/empty-state";
import {
  PageShell,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { ensureDb } from "@/db/ensure";
import {
  getJobLearningDashboard,
  getLearningDashboard,
} from "@/modules/learning/queries";
import { getTodayMode } from "@/modules/jobs/queries";
import { LearningModeSwitch } from "@/components/learning-mode-switch";

export const dynamic = "force-dynamic";

export default async function LearningPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  ensureDb();
  const sp = searchParams ? await searchParams : {};
  const todayMode = getTodayMode();
  const mode =
    sp.mode === "clients" || sp.mode === "jobs"
      ? sp.mode
      : todayMode === "clients"
        ? "clients"
        : "jobs";

  const clientsDash = getLearningDashboard();
  const jobsDash = getJobLearningDashboard();
  const pending = clientsDash.proposals.filter(
    (p) => p.status === "pending" && p.kind !== "search_strategy",
  );

  return (
    <PageShell className="gap-6 lg:gap-8">
      <SectionTitle
        title="Learning"
        description="Proposals need your approval. Nothing important applies automatically."
        actions={<LearningModeSwitch mode={mode} />}
      />

      {mode === "jobs" ? (
        <JobLearningHub dash={jobsDash} />
      ) : (
        <>
          <Surface>
            <PanelHeader className="justify-between">
              <div className="min-w-0 space-y-1">
                <p className="font-display text-[16px] font-semibold tracking-tight">
                  Data gates
                </p>
                <p className="text-muted-foreground text-[13px]">
                  30 days of signals · 20 edited drafts · 50 delivered
                </p>
              </div>
              <Badge variant={clientsDash.gates.ready ? "secondary" : "outline"}>
                {clientsDash.gates.ready ? "Ready" : "Not ready"}
              </Badge>
            </PanelHeader>
            <PanelBody>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  days {clientsDash.gates.daysOfSignals}/30
                </Badge>
                <Badge variant="outline">
                  edits {clientsDash.gates.editedDrafts}/20
                </Badge>
                <Badge variant="outline">
                  delivered {clientsDash.gates.deliveredMessages}/50
                </Badge>
              </div>
              {clientsDash.gates.missing.length > 0 ? (
                <p className="text-muted-foreground text-[13px]">
                  Missing: {clientsDash.gates.missing.join(" · ")}
                </p>
              ) : null}
              <LearningControls gatesReady={clientsDash.gates.ready} />
            </PanelBody>
          </Surface>

          <Surface>
            <PanelHeader>
              <p className="font-display text-[16px] font-semibold tracking-tight">
                Source performance
              </p>
            </PanelHeader>
            {clientsDash.source.rows.length === 0 ? (
              <EmptyState
                title="No sources yet"
                description="After you accept and send outreach, source rates appear here."
                actionLabel="Go to Today"
                actionHref="/"
              />
            ) : (
              <div className="overflow-x-auto px-6 py-4 sm:px-8">
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="text-muted-foreground border-b text-[13px]">
                      <th className="py-3 pr-4 font-medium">Source</th>
                      <th className="py-3 pr-4 font-medium">Sig</th>
                      <th className="py-3 pr-4 font-medium">Leads</th>
                      <th className="py-3 pr-4 font-medium">Acc%</th>
                      <th className="py-3 font-medium">Reply%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientsDash.source.rows.map((r) => (
                      <tr
                        key={r.source}
                        className="border-border border-b last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium">{r.source}</td>
                        <td className="tabular py-4 pr-4">{r.signals}</td>
                        <td className="tabular py-4 pr-4">{r.leads}</td>
                        <td className="tabular py-4 pr-4">
                          {(r.acceptRate * 100).toFixed(0)}%
                        </td>
                        <td className="tabular py-4">
                          {(r.replyRate * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>

          <Surface>
            <PanelHeader className="justify-between">
              <p className="font-display text-[16px] font-semibold tracking-tight">
                Pending proposals
              </p>
              <span className="text-muted-foreground tabular text-[13px]">
                {pending.length}
              </span>
            </PanelHeader>
            {pending.length === 0 ? (
              <EmptyState
                title="None pending"
                description="When gates are met, learning proposals wait here for approval."
                actionLabel="Open Queue"
                actionHref="/queue"
              />
            ) : (
              <div className="divide-border divide-y">
                {pending.map((p) => (
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
                    <pre className="bg-muted/50 max-h-40 overflow-auto rounded-xl p-4 text-[13px]">
                      {p.proposalJson}
                    </pre>
                    <ProposalActions proposalId={p.id} />
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface>
            <PanelHeader>
              <p className="font-display text-[16px] font-semibold tracking-tight">
                Reports
              </p>
            </PanelHeader>
            {clientsDash.reports.filter((r) => r.kind !== "job_weekly_insights")
              .length === 0 ? (
              <EmptyState
                title="No reports yet"
                description="Generated learning reports will show up here."
              />
            ) : (
              <div className="divide-border divide-y">
                {clientsDash.reports
                  .filter((r) => r.kind !== "job_weekly_insights")
                  .map((r) => (
                    <div
                      key={r.id}
                      className="space-y-3 px-6 py-6 sm:px-8 sm:py-7"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="secondary">{r.kind}</Badge>
                        <span className="font-display text-[16px] font-semibold">
                          {r.title}
                        </span>
                      </div>
                      <pre className="text-muted-foreground whitespace-pre-wrap text-[14px] leading-relaxed">
                        {r.bodyMd.slice(0, 2000)}
                        {r.bodyMd.length > 2000 ? "…" : ""}
                      </pre>
                    </div>
                  ))}
              </div>
            )}
          </Surface>
        </>
      )}
    </PageShell>
  );
}
