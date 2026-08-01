import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import {
  PageShell,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ensureDb } from "@/db/ensure";
import { getLearningDashboard } from "@/modules/learning/queries";
import { cn } from "@/lib/utils";

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

  const hasActivity = funnel.totalLeads > 0 || funnel.sent > 0;

  return (
    <PageShell className="gap-6 lg:gap-8">
      <SectionTitle
        title="Analytics"
        description="Funnel snapshot from your outreach activity."
        actions={
          <Link
            href="/learning"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Learning
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Surface key={k.label} className="px-5 py-5">
            <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
              {k.label}
            </p>
            <p className="font-display tabular mt-2 text-[28px] font-semibold tracking-tight text-[var(--card-foreground)]">
              {k.value}
            </p>
          </Surface>
        ))}
      </div>

      {!hasActivity ? (
        <Surface>
          <EmptyState
            title="No activity yet"
            description="Accept companies on Today and send outreach to populate this funnel."
            actionLabel="Go to Today"
            actionHref="/"
          />
        </Surface>
      ) : (
        <>
          <Surface>
            <PanelHeader>
              <p className="font-display text-[16px] font-semibold tracking-tight">
                Pipeline states
              </p>
            </PanelHeader>
            <ul className="grid gap-0 text-[15px] sm:grid-cols-2">
              {Object.entries(funnel.stateCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([state, count]) => (
                  <li
                    key={state}
                    className="border-border flex justify-between gap-4 border-b px-6 py-3.5 last:border-0 sm:px-8 sm:odd:border-r"
                  >
                    <span>{state}</span>
                    <span className="tabular font-semibold">{count}</span>
                  </li>
                ))}
            </ul>
          </Surface>

          <Surface>
            <PanelHeader>
              <p className="font-display text-[16px] font-semibold tracking-tight">
                Draft quality
              </p>
            </PanelHeader>
            <PanelBody className="flex flex-wrap gap-2.5">
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
              <p className="font-display text-[16px] font-semibold tracking-tight">
                By source
              </p>
            </PanelHeader>
            {source.rows.length === 0 ? (
              <EmptyState
                title="No source data"
                description="Source breakdown appears after you accept leads from discovery."
                actionLabel="Go to Today"
                actionHref="/"
              />
            ) : (
              <ul className="divide-border divide-y text-[15px]">
                {source.rows.map((r) => (
                  <li
                    key={r.source}
                    className="flex justify-between gap-4 px-6 py-4 sm:px-8"
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
        </>
      )}
    </PageShell>
  );
}
