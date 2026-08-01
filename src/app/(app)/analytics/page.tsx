import Link from "next/link";
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

export default function AnalyticsPage() {
  ensureDb();
  const { funnel, source } = getLearningDashboard();

  const kpis = [
    { label: "Leads", value: funnel.totalLeads },
    { label: "Sent", value: funnel.sent },
    { label: "Replies", value: funnel.replies },
    {
      label: "Reply rate",
      value: `${(funnel.replyRate * 100).toFixed(0)}%`,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        description="Funnel snapshot. Deeper ATS / remote / multi-user analytics stay deferred."
        meta={
          <Link href="/learning" className="hover:text-foreground">
            ← Learning
          </Link>
        }
      />

      <div className="grid gap-6 sm:grid-cols-4">
        {kpis.map((k) => (
          <Surface key={k.label} className="px-6 py-6">
            <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
              {k.label}
            </p>
            <p className="font-display tabular mt-3 text-[32px] font-semibold tracking-tight text-[var(--card-foreground)]">
              {k.value}
            </p>
          </Surface>
        ))}
      </div>

      <Surface>
        <PanelHeader>
          <SectionTitle title="Pipeline states" />
        </PanelHeader>
        <ul className="grid gap-0 text-[15px] sm:grid-cols-2">
          {Object.entries(funnel.stateCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([state, count]) => (
              <li
                key={state}
                className="border-border flex justify-between gap-4 border-b px-8 py-4 last:border-0 sm:odd:border-r"
              >
                <span>{state}</span>
                <span className="tabular font-semibold">{count}</span>
              </li>
            ))}
        </ul>
      </Surface>

      <Surface>
        <PanelHeader>
          <SectionTitle title="Draft quality" />
        </PanelHeader>
        <PanelBody className="flex flex-wrap gap-3">
          <Badge variant="outline">edits {funnel.editedDrafts}</Badge>
          <Badge variant="outline">
            avg edit {(funnel.avgEditRatio * 100).toFixed(0)}%
          </Badge>
          <Badge variant="outline">
            major rewrite {(funnel.majorRewriteRate * 100).toFixed(0)}%
          </Badge>
        </PanelBody>
      </Surface>

      <Surface>
        <PanelHeader>
          <SectionTitle title="By source" />
        </PanelHeader>
        {source.rows.length === 0 ? (
          <p className="text-muted-foreground px-8 py-10 text-[15px]">
            No data.
          </p>
        ) : (
          <ul className="divide-border divide-y text-[15px]">
            {source.rows.map((r) => (
              <li
                key={r.source}
                className="flex justify-between gap-4 px-8 py-5"
              >
                <span className="font-medium">{r.source}</span>
                <span className="text-muted-foreground tabular text-[13px]">
                  {r.accepted}/{r.leads} accept · {r.replied}/{r.sent} reply
                </span>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </PageShell>
  );
}
