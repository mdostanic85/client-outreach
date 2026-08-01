import { LearningControls, ProposalActions } from "@/components/learning-controls";
import { EmptyState } from "@/components/empty-state";
import {
  PageHeader,
  PageShell,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { ensureDb } from "@/db/ensure";
import { getLearningDashboard } from "@/modules/learning/queries";

export const dynamic = "force-dynamic";

export default function LearningPage() {
  ensureDb();
  const dash = getLearningDashboard();
  const pending = dash.proposals.filter((p) => p.status === "pending");

  return (
    <PageShell>
      <PageHeader
        title="Learning"
        description="Proposals need your approval. Nothing applies automatically."
      />

      <Surface>
        <PanelHeader className="justify-between">
          <SectionTitle
            title="Data gates"
            description="Need 30 days of signals · 20 edited drafts · 50 delivered"
          />
          <Badge variant={dash.gates.ready ? "secondary" : "outline"}>
            {dash.gates.ready ? "Ready" : "Not ready"}
          </Badge>
        </PanelHeader>
        <PanelBody>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              days {dash.gates.daysOfSignals}/30
            </Badge>
            <Badge variant="outline">
              edits {dash.gates.editedDrafts}/20
            </Badge>
            <Badge variant="outline">
              delivered {dash.gates.deliveredMessages}/50
            </Badge>
          </div>
          {dash.gates.missing.length > 0 ? (
            <p className="text-muted-foreground text-[13px]">
              Missing: {dash.gates.missing.join(" · ")}
            </p>
          ) : null}
          <LearningControls gatesReady={dash.gates.ready} />
        </PanelBody>
      </Surface>

      <Surface>
        <PanelHeader>
          <SectionTitle title="Source performance" />
        </PanelHeader>
        {dash.source.rows.length === 0 ? (
          <EmptyState
            title="No sources yet"
            description="After you accept and send leads, source rates appear here."
          />
        ) : (
          <div className="overflow-x-auto px-8 py-4">
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
                {dash.source.rows.map((r) => (
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
          <SectionTitle title="Pending proposals" />
          <span className="tabular text-muted-foreground text-[13px]">
            {pending.length}
          </span>
        </PanelHeader>
        {pending.length === 0 ? (
          <EmptyState
            title="None pending"
            description="When gates are met, learning proposals will wait here for approval."
          />
        ) : (
          <div className="divide-border divide-y">
            {pending.map((p) => (
              <div key={p.id} className="space-y-4 px-8 py-8">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline">{p.kind}</Badge>
                  <span className="font-display text-[17px] font-semibold">
                    {p.title}
                  </span>
                </div>
                <p className="text-muted-foreground text-[14px]">{p.summary}</p>
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
          <SectionTitle title="Reports" />
        </PanelHeader>
        {dash.reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            description="Generated learning reports will show up here."
          />
        ) : (
          <div className="divide-border divide-y">
            {dash.reports.map((r) => (
              <div key={r.id} className="space-y-3 px-8 py-8">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{r.kind}</Badge>
                  <span className="font-display text-[17px] font-semibold">
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
    </PageShell>
  );
}
