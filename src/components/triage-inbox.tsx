"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Building2, ChevronDown, ExternalLink } from "lucide-react";
import {
  acceptLeadAction,
  rejectLeadAction,
  runDailyPipelineAction,
  saveForLaterAction,
} from "@/app/actions";
import { DiscoverControls } from "@/components/discover-controls";
import { EmptyState } from "@/components/empty-state";
import {
  PageHeader,
  PageShell,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import { PolicyPill, StatePill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TriageRow = {
  leadId: string;
  companyName: string;
  domain: string | null;
  country: string | null;
  score: number | null;
  state: string;
  policy: string;
  oneLiner: string | null;
  topNeed: string | null;
  whyFit: string | null;
  unknowns: string[];
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  hasBrief: boolean;
};

type Filter = "all" | "new" | "saved";

function FitScore({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="text-muted-foreground tabular text-[13px]">—</span>
    );
  }
  const strong = score >= 70;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold tabular-nums",
        strong
          ? "bg-primary/15 text-primary"
          : "bg-muted text-muted-foreground",
      )}
      title="Fit score"
    >
      <span className="text-[10px] font-medium uppercase opacity-70">Fit</span>
      {Number.isInteger(score) ? score : score.toFixed(1)}
    </span>
  );
}

export function TriageInbox({
  rows,
  embedded = false,
}: {
  rows: TriageRow[];
  /** When true, skip PageShell (parent already provides layout). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showDiscover, setShowDiscover] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "saved") {
      return rows.filter((r) => r.state === "saved_for_later");
    }
    if (filter === "new") {
      return rows.filter((r) => r.state !== "saved_for_later");
    }
    return rows;
  }, [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      new: rows.filter((r) => r.state !== "saved_for_later").length,
      saved: rows.filter((r) => r.state === "saved_for_later").length,
    }),
    [rows],
  );

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    afterOk?: () => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else {
        afterOk?.();
        router.refresh();
      }
    });
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "new", label: "To review", count: counts.new },
    { id: "saved", label: "Saved", count: counts.saved },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {rows.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await runDailyPipelineAction();
              return result;
            })
          }
        >
          Refresh
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDiscover((v) => !v)}
      >
        {showDiscover ? "Hide" : "Add company"}
      </Button>
    </div>
  );

  const body = (
    <>
      {embedded ? (
        <SectionTitle
          title="Today · Clients"
          description="Accept to write outreach, save for later, or skip."
          actions={headerActions}
        />
      ) : (
        <PageHeader
          title="Today · Clients"
          description="Accept to write outreach, save for later, or skip."
          actions={headerActions}
        />
      )}

      {showDiscover ? (
        <Surface className="px-5 py-5 sm:px-6">
          <DiscoverControls />
        </Surface>
      ) : null}

      {error ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-[14px]">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Surface>
          <EmptyState
            title="No companies yet"
            description="Find companies to fill this inbox, or add a company URL."
            actionId="today-primary-action"
            actionLabel={pending ? "Finding…" : "Find companies"}
            pending={pending}
            icon={
              <Building2 className="size-6 opacity-70" strokeWidth={1.5} />
            }
            onAction={() =>
              run(async () => {
                const result = await runDailyPipelineAction();
                return result;
              })
            }
          />
          <div className="border-border border-t px-5 py-4 sm:px-6">
            <DiscoverControls />
          </div>
        </Surface>
      ) : (
        <Surface>
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div
              role="tablist"
              aria-label="Client filters"
              className="bg-muted/50 border-border inline-flex rounded-xl border p-1"
            >
              {filters.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.id}
                  onClick={() => setFilter(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                    filter === t.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className="tabular opacity-80">{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              className="py-12"
              title="Nothing in this filter"
              description="Try All or To review, or save a company for later."
              actionLabel="Show all"
              onAction={() => setFilter("all")}
            />
          ) : (
            <ul className="divide-border divide-y">
              {filtered.map((row) => {
                const open = expandedId === row.leadId;
                const summary = row.topNeed ?? row.oneLiner;
                const meta = [row.domain, row.country]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li
                    key={row.leadId}
                    className="hover:bg-accent-wash/40 transition-colors"
                  >
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5 sm:py-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/leads/${row.leadId}`}
                            className="text-[15px] font-semibold text-[var(--card-foreground)] hover:text-primary"
                          >
                            {row.companyName}
                          </Link>
                          <FitScore score={row.score} />
                          <StatePill
                            state={row.state}
                            className="px-2 py-0.5 text-[11px]"
                          />
                          {row.policy !== "draft_allowed" &&
                          row.policy !== "unknown" ? (
                            <PolicyPill
                              policy={row.policy}
                              className="px-2 py-0.5 text-[11px]"
                            />
                          ) : null}
                        </div>

                        {meta ? (
                          <p className="text-muted-foreground text-[13px]">
                            {meta}
                          </p>
                        ) : null}

                        {summary ? (
                          <p
                            className={cn(
                              "text-muted-foreground text-[14px] leading-relaxed",
                              !open && "line-clamp-2",
                            )}
                          >
                            {summary}
                          </p>
                        ) : null}

                        {open ? (
                          <div className="border-border/60 space-y-2 border-t pt-3 text-[13px]">
                            {row.whyFit ? (
                              <p>
                                <span className="text-foreground font-medium">
                                  Why it fits ·{" "}
                                </span>
                                <span className="text-muted-foreground">
                                  {row.whyFit}
                                </span>
                              </p>
                            ) : null}
                            {row.unknowns.length > 0 ? (
                              <p className="text-warn">
                                Uncertainty · {row.unknowns.join(" · ")}
                              </p>
                            ) : null}
                            {row.sourceUrl ? (
                              <a
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                                href={row.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {row.sourceName}: {row.sourceTitle}
                                <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ) : null}
                            <Link
                              href={`/leads/${row.leadId}`}
                              className="text-primary inline-flex text-[13px] font-medium underline-offset-2 hover:underline"
                            >
                              Open company →
                            </Link>
                          </div>
                        ) : null}

                        {rejectingId === row.leadId ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Input
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reject reason (required)"
                              className="max-w-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={pending || !rejectReason.trim()}
                              onClick={() =>
                                run(
                                  () =>
                                    rejectLeadAction(
                                      row.leadId,
                                      rejectReason.trim(),
                                    ),
                                  () => {
                                    setRejectingId(null);
                                    setRejectReason("");
                                  },
                                )
                              }
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            disabled={pending || !row.hasBrief}
                            onClick={() =>
                              run(() => acceptLeadAction(row.leadId), () =>
                                router.push(`/leads/${row.leadId}`),
                              )
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending || !row.hasBrief}
                            onClick={() =>
                              run(() => saveForLaterAction(row.leadId))
                            }
                          >
                            Later
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => {
                              setRejectingId(row.leadId);
                              setRejectReason("");
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[12px] font-medium"
                          onClick={() =>
                            setExpandedId(open ? null : row.leadId)
                          }
                        >
                          {open ? "Less" : "Details"}
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform",
                              open && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-5">{body}</div>;
  }

  return <PageShell className="gap-6 lg:gap-8">{body}</PageShell>;
}
