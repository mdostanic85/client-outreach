"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { QueueControls } from "@/components/queue-controls";
import { EmptyState } from "@/components/empty-state";
import {
  PageHeader,
  PageShell,
  PanelHeader,
  Surface,
} from "@/components/page-shell";
import { SegmentedControl } from "@/components/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { listOutboundBoard } from "@/modules/mail/queries";
import { Inbox, Mail, Send, TriangleAlert } from "lucide-react";

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
        description="Review pending drafts and monitor scheduled mail."
        actions={<QueueControls paused={paused} />}
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-5 py-3.5 text-[14px] shadow-[var(--shadow-card)]">
        <span
          className={cn(
            "size-2 rounded-full",
            paused
              ? "bg-destructive status-pulse"
              : status.credentialsConfigured
                ? "bg-primary status-pulse"
                : "bg-warn status-pulse",
          )}
        />
        {paused ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="cursor-help font-medium text-[var(--card-foreground)]">
                  Paused — {status.health.pauseReason ?? "deliverability"}
                </span>
              }
            />
            <TooltipContent className="max-w-xs text-left leading-relaxed">
              Sending is stopped. Resume only when the mailbox issue is fixed.
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="font-medium text-[var(--card-foreground)]">
            {status.credentialsConfigured
              ? "Mailbox connected"
              : "Mailbox not connected — add credentials in Admin."}
          </span>
        )}
        <span className="text-muted-foreground hidden sm:inline" aria-hidden>
          ·
        </span>
        <span className="text-[var(--card-foreground)]">
          Sent today:{" "}
          <span className="tabular font-medium">{status.sentToday}</span>
        </span>
        <span className="text-muted-foreground hidden sm:inline" aria-hidden>
          ·
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="cursor-help text-[var(--card-foreground)]">
                Remaining today:{" "}
                <span className="tabular font-medium">
                  {status.remainingToday}
                </span>
              </span>
            }
          />
          <TooltipContent className="max-w-xs text-left leading-relaxed">
            How many new outreach emails Optra will still send today under your
            send limits.
          </TooltipContent>
        </Tooltip>
      </div>

      <Surface>
        <PanelHeader className="gap-2">
          <SegmentedControl
            ariaLabel="Queue status"
            value={tab}
            onChange={setTab}
            options={tabs.map((t) => ({
              id: t.id,
              label: t.label,
              count: t.count,
            }))}
          />
        </PanelHeader>

        {tab === "pending" ? (
          board.pending.length === 0 ? (
            <EmptyState
              title="No drafts waiting"
              description="Write outreach on a company from Today, then approve it into the send queue."
              actionLabel="Go to Today"
              actionHref="/"
              icon={<Inbox className="size-6 opacity-70" strokeWidth={1.5} />}
            />
          ) : (
            <ul className="divide-border divide-y">
              {board.pending.map((item, index) => (
                <QueueRow
                  key={item.draft.id}
                  index={index}
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
              title="Nothing scheduled"
              description="Approved drafts wait here until the send worker processes them."
              actionLabel="Review pending"
              onAction={() => setTab("pending")}
              icon={<Mail className="size-6 opacity-70" strokeWidth={1.5} />}
            />
          ) : (
            <ul className="divide-border divide-y">
              {board.scheduled.map((item, index) => (
                <QueueRow
                  key={item.approval.id}
                  index={index}
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
              description="Successful sends show up here after the worker processes the queue."
              actionLabel="View scheduled"
              onAction={() => setTab("scheduled")}
              icon={<Send className="size-6 opacity-70" strokeWidth={1.5} />}
            />
          ) : (
            <ul className="divide-border divide-y">
              {board.sent.map((item, index) => (
                <QueueRow
                  key={item.draft.id}
                  index={index}
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
              description="Bounces and send failures will list here if something goes wrong."
              icon={
                <TriangleAlert className="size-6 opacity-70" strokeWidth={1.5} />
              }
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
                      <p className="text-muted-foreground text-sm">
                        {item.event.detail ?? item.event.leadId ?? "—"}
                      </p>
                    </div>
                    <Badge variant="destructive">{item.event.eventType}</Badge>
                  </div>
                  <p className="text-muted-foreground tabular text-sm">
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
          className="text-muted-foreground hover:text-foreground text-sm"
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
                    <span className="text-muted-foreground tabular shrink-0 text-sm">
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
  index = 0,
}: {
  href: string;
  title: string;
  subtitle: string;
  subject?: string | null;
  meta: string;
  badge: string;
  preview?: string | null;
  actionLabel?: string;
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const stagger = Math.min(Math.max(index, 0), 10);

  return (
    <li
      className="row-accent interactive-row stagger-item space-y-3 px-8 py-6"
      style={{ "--stagger-index": stagger } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={href}
            className="text-[16px] font-semibold text-[var(--card-foreground)] hover:text-primary"
          >
            {title}
          </Link>
          <p className="text-muted-foreground text-[15px]">{subtitle}</p>
        </div>
        <Badge variant="outline">{badge}</Badge>
      </div>
      {subject ? <p className="text-[15px]">{subject}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground tabular text-sm">{meta}</p>
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
        <pre className="animate-expand bg-muted/50 text-muted-foreground max-h-40 overflow-auto rounded-md p-3 text-sm whitespace-pre-wrap">
          {preview}
        </pre>
      ) : null}
    </li>
  );
}
