"use client";

import Link from "next/link";
import { useState } from "react";
import { QueueControls } from "@/components/queue-controls";
import { EmptyState } from "@/components/empty-state";
import {
  PageHeader,
  PageShell,
  PanelHeader,
  Surface,
} from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { listOutboundBoard } from "@/modules/mail/queries";

type Board = ReturnType<typeof listOutboundBoard>;
type Tab = "pending" | "scheduled" | "sent" | "failed";

export function QueueBoard({
  board,
  status,
  events,
}: {
  board: Board;
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
}) {
  const [tab, setTab] = useState<Tab>(
    board.counts.pending > 0 ? "pending" : "scheduled",
  );
  const [showEvents, setShowEvents] = useState(false);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: board.counts.pending },
    { id: "scheduled", label: "Scheduled", count: board.counts.scheduled },
    { id: "sent", label: "Sent", count: board.counts.sent },
    { id: "failed", label: "Failed", count: board.counts.failed },
  ];

  const paused = Boolean(status.health.pausedAt);

  return (
    <PageShell>
      <PageHeader
        title="Queue"
        description={`Max ${status.policy.maxNewPerDay}/day · ${status.sentToday} sent · ${status.remainingToday} remaining${status.policy.weekdaysOnly ? " · weekdays only" : ""}`}
        actions={<QueueControls paused={paused} />}
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-4 rounded-[18px] border px-8 py-6 text-[15px] shadow-[var(--shadow-card)]">
        <span
          className={cn(
            "size-2.5 rounded-full",
            paused
              ? "bg-destructive"
              : status.credentialsConfigured
                ? "bg-primary shadow-[0_0_12px_rgba(57,161,133,0.5)]"
                : "bg-warn",
          )}
        />
        <span className="font-medium text-[var(--card-foreground)]">
          {paused
            ? `Paused — ${status.health.pauseReason ?? "deliverability"}`
            : status.credentialsConfigured
              ? "Mailbox healthy"
              : "Mailbox credentials missing"}
        </span>
        <span className="text-muted-foreground text-[13px]">
          Credentials stay in macOS Keychain
        </span>
      </div>

      <Surface>
        <PanelHeader>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-white/5 hover:text-[var(--card-foreground)]",
              )}
            >
              {t.label}
              <span className="tabular opacity-80">{t.count}</span>
            </button>
          ))}
        </PanelHeader>

        {tab === "pending" ? (
          board.pending.length === 0 ? (
            <EmptyState
              title="No drafts waiting for approval"
              description="Generate and edit outreach on a lead, then approve it into the scheduled queue."
            />
          ) : (
            <ul className="divide-border divide-y">
              {board.pending.map((item) => (
                <QueueRow
                  key={item.draft.id}
                  href={`/leads/${item.lead?.id}`}
                  title={item.company?.name ?? "Lead"}
                  subtitle={`To: ${item.contact?.email ?? "—"}`}
                  subject={item.draft.subject}
                  meta={`Updated ${item.draft.updatedAt.slice(0, 16).replace("T", " ")}`}
                  badge="Needs review"
                  actionLabel="Review"
                />
              ))}
            </ul>
          )
        ) : null}

        {tab === "scheduled" ? (
          board.scheduled.length === 0 ? (
            <EmptyState
              title="Queue is empty"
              description="Approved drafts appear here until the send worker processes them."
            />
          ) : (
            <ul className="divide-border divide-y">
              {board.scheduled.map((item) => (
                <QueueRow
                  key={item.approval.id}
                  href={`/leads/${item.lead?.id}`}
                  title={item.company?.name ?? "Lead"}
                  subtitle={`To: ${item.approval.recipientEmail}`}
                  subject={item.draft?.subject ?? item.approval.subjectSnapshot}
                  meta={`Approved ${item.approval.approvedAt.slice(0, 16).replace("T", " ")}`}
                  badge={item.contact?.confidence ?? "queued"}
                  preview={item.approval.bodySnapshot}
                />
              ))}
            </ul>
          )
        ) : null}

        {tab === "sent" ? (
          board.sent.length === 0 ? (
            <EmptyState
              title="Nothing sent yet"
              description="Processed queue items show up here after a successful send."
            />
          ) : (
            <ul className="divide-border divide-y">
              {board.sent.map((item) => (
                <QueueRow
                  key={item.draft.id}
                  href={`/leads/${item.lead?.id}`}
                  title={item.company?.name ?? "Lead"}
                  subtitle={`To: ${item.contact?.email ?? "—"}`}
                  subject={item.draft.subject}
                  meta={`Sent ${item.draft.updatedAt.slice(0, 16).replace("T", " ")}`}
                  badge="Sent"
                />
              ))}
            </ul>
          )
        ) : null}

        {tab === "failed" ? (
          board.failed.length === 0 ? (
            <EmptyState
              title="No delivery failures"
              description="Hard/soft bounces and send failures will list here."
            />
          ) : (
            <ul className="divide-border divide-y">
              {board.failed.map((item) => (
                <li key={item.event.id} className="row-accent space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {item.lead ? (
                        <Link
                          href={`/leads/${item.lead.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {item.company?.name ?? "Lead"}
                        </Link>
                      ) : (
                        <span className="font-medium">Delivery event</span>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {item.event.detail ?? item.event.leadId ?? "—"}
                      </p>
                    </div>
                    <Badge variant="destructive">{item.event.eventType}</Badge>
                  </div>
                  <p className="text-muted-foreground tabular text-xs">
                    {item.event.occurredAt.slice(0, 16).replace("T", " ")}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Surface>

      <div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs"
          onClick={() => setShowEvents((v) => !v)}
        >
          {showEvents ? "Hide delivery log" : "Show delivery log"}
        </button>
        {showEvents ? (
          <Surface className="mt-2">
            {events.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-sm">
                No events yet.
              </p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="min-w-0 truncate">
                      <Badge variant="outline" className="mr-2">
                        {e.eventType}
                      </Badge>
                      {e.detail ?? e.leadId ?? "—"}
                    </span>
                    <span className="text-muted-foreground tabular shrink-0 text-xs">
                      {e.occurredAt.slice(0, 16).replace("T", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        ) : null}
      </div>
    </PageShell>
  );
}

function QueueRow({
  href,
  title,
  subtitle,
  subject,
  meta,
  badge,
  preview,
  actionLabel,
}: {
  href: string;
  title: string;
  subtitle: string;
  subject?: string | null;
  meta: string;
  badge: string;
  preview?: string | null;
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="row-accent hover:bg-accent-wash/50 space-y-3 px-8 py-6 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={href}
            className="text-[16px] font-semibold text-[var(--card-foreground)] hover:text-primary"
          >
            {title}
          </Link>
          <p className="text-muted-foreground text-[13px]">{subtitle}</p>
        </div>
        <Badge variant="outline">{badge}</Badge>
      </div>
      {subject ? <p className="text-[15px]">{subject}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground tabular text-xs">{meta}</p>
        {preview ? (
          <Button size="lg" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Preview"}
          </Button>
        ) : null}
        {actionLabel ? (
          <Link
            href={href}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-11 items-center rounded-xl px-4 text-[15px] font-medium"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      {open && preview ? (
        <pre className="bg-muted/50 text-muted-foreground max-h-40 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
          {preview}
        </pre>
      ) : null}
    </li>
  );
}
