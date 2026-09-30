import Link from "next/link";
import { AnalyticsKpiGrid } from "@/components/analytics-kpi-grid";
import { EmptyState } from "@/components/empty-state";
import {
  PageGrid,
  PageHeader,
  PageShell,
  PanelBody,
  PanelHeader,
  Surface,
} from "@/components/page-shell";
import { BarList } from "@/components/ui/bar-list";
import { StatTile } from "@/components/ui/stat-tile";
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
          <PageGrid>
            <Surface className="md:col-span-7">
              <PanelHeader>
                <h2 className="text-foreground text-body font-medium">Pipeline states</h2>
              </PanelHeader>
              <PanelBody className="px-2 py-3 sm:px-4 sm:py-4">
                <BarList
                  items={Object.entries(funnel.stateCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([state, count]) => ({
                      key: state,
                      label: labelLeadState(state),
                      value: count,
                    }))}
                />
              </PanelBody>
            </Surface>

            <Surface className="md:col-span-5">
              <PanelHeader>
                <h2 className="text-foreground text-body font-medium">Draft quality</h2>
              </PanelHeader>
              <PanelBody className="grid grid-cols-3 gap-3">
                <StatTile label="Edited" value={funnel.editedDrafts} />
                <StatTile
                  label="Avg edit"
                  value={`${(funnel.avgEditRatio * 100).toFixed(0)}%`}
                />
                <StatTile
                  label="Rewrites"
                  value={`${(funnel.majorRewriteRate * 100).toFixed(0)}%`}
                />
              </PanelBody>
            </Surface>

            <Surface className="md:col-span-12">
              <PanelHeader>
                <h2 className="text-foreground text-body font-medium">By source</h2>
                <p className="text-muted-foreground text-body-sm">Reply rate per source</p>
              </PanelHeader>
              {source.rows.length === 0 ? (
                <EmptyState
                  title="No source data"
                  description="Source breakdown appears after you accept leads from discovery."
                  actionLabel="Go to Today"
                  actionHref="/"
                />
              ) : (
                <PanelBody className="px-2 py-3 sm:px-4 sm:py-4">
                  <BarList
                    max={1}
                    items={source.rows.map((r) => ({
                      key: r.source,
                      label: r.source,
                      value: r.sent > 0 ? r.replied / r.sent : 0,
                      display: (
                        <span>
                          {r.replied}/{r.sent} reply
                          <span className="text-muted-foreground">
                            {" "}
                            · {r.accepted}/{r.leads} accept
                          </span>
                        </span>
                      ),
                    }))}
                  />
                </PanelBody>
              )}
            </Surface>
          </PageGrid>
        </>
      )}
    </PageShell>
  );
}
