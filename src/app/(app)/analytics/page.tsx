import Link from "next/link";
import { AnalyticsKpiGrid } from "@/components/analytics-kpi-grid";
import { EmptyState } from "@/components/empty-state";
import {
  PageHeader,
  PageShell,
  PanelBody,
  PanelHeader,
  Surface,
} from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ensureDb } from "@/db/ensure";
import { getLearningDashboard } from "@/modules/learning/queries";
import { labelLeadState } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";
import { requireOwnerPage } from "@/modules/auth/page-guards";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireOwnerPage();
  await ensureDb();
  const { funnel, source } = await getLearningDashboard();

  const hasActivity = funnel.totalLeads > 0 || funnel.sent > 0;

  return (
    <PageShell>
      <PageHeader
        title="Outreach analytics"
        description="Funnel snapshot from your outreach activity."
        actions={
          <Link
            href="/learning"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Improve
          </Link>
        }
      />

      <AnalyticsKpiGrid
        totalLeads={funnel.totalLeads}
        sent={funnel.sent}
        replies={funnel.replies}
        replyRate={funnel.replyRate}
      />

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
                    <span>{labelLeadState(state)}</span>
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
                    <span className="text-muted-foreground tabular text-[15px]">
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
