"use client";

import { useMemo, useState } from "react";
import { ApplicationsKanban } from "@/components/applications-kanban";
import { QueueBoard } from "@/components/queue-board";
import {
  PageHeader,
  PageShell,
} from "@/components/page-shell";
import { SegmentedControl } from "@/components/segmented-control";
import type { ApplicationMailBoard } from "@/modules/applications/board";
import type { listOutboundBoard } from "@/modules/mail/queries";

type OutreachBoard = Awaited<ReturnType<typeof listOutboundBoard>>;
type WorkspaceTab = "applications" | "outreach";

export function QueueWorkspace({
  applications,
  outreach,
  status,
  events,
  initialTab = "applications",
}: {
  applications: ApplicationMailBoard;
  outreach: OutreachBoard;
  status: {
    credentialsConfigured: boolean;
    health: { pausedAt?: string | null; pauseReason?: string | null };
    policy: { maxNewPerDay: number; weekdaysOnly: boolean };
    sentToday: number;
    remainingToday: number;
  };
  events: Array<{
    id: string;
    eventType: string;
    detail: string | null;
    leadId: string | null;
    occurredAt: string;
  }>;
  initialTab?: WorkspaceTab;
}) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);

  const appCount = useMemo(
    () =>
      applications.sent.length +
      applications.waiting.length +
      applications.follow_up.length,
    [applications],
  );

  const outreachPending = outreach.counts.pending + outreach.counts.scheduled;

  return (
    <PageShell>
      <PageHeader
        title="Queue"
        description="Track sent applications and outreach mail."
        meta={
          tab === "applications"
            ? `${appCount} application${appCount === 1 ? "" : "s"}`
            : undefined
        }
      />

      <SegmentedControl
        options={[
          { id: "applications" as const, label: "Applications", count: appCount },
          {
            id: "outreach" as const,
            label: "Outreach",
            count: outreachPending > 0 ? outreachPending : undefined,
          },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Queue sections"
      />

      {tab === "applications" ? (
        <ApplicationsKanban board={applications} />
      ) : (
        <QueueBoard board={outreach} status={status} events={events} embedded />
      )}
    </PageShell>
  );
}
