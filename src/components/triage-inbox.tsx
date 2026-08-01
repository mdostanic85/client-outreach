"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
  PanelHeader,
  Surface,
} from "@/components/page-shell";
import { PolicyPill, ScoreMark, StatePill } from "@/components/status-pill";
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

export function TriageInbox({ rows }: { rows: TriageRow[] }) {
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

  const Chip = ({
    id,
    label,
    count,
  }: {
    id: Filter;
    label: string;
    count: number;
  }) => (
    <button
      type="button"
      onClick={() => setFilter(id)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors duration-150",
        filter === id
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-white/5 hover:text-[var(--card-foreground)]",
      )}
    >
      {label}
      <span className="tabular opacity-80">{count}</span>
    </button>
  );

  return (
    <PageShell>
      <PageHeader
        title="Today · Clients"
        description="Companies ranked for outreach. Accept, save, or skip, then open one to write."
        meta={
          rows.length > 0 ? (
            <span className="tabular">{counts.new} to review</span>
          ) : undefined
        }
        actions={
          <Button
            variant="outline"
            onClick={() => setShowDiscover((v) => !v)}
          >
            {showDiscover ? "Hide discover" : "Add company"}
          </Button>
        }
      />

      {showDiscover ? (
        <Surface className="p-8">
          <DiscoverControls />
        </Surface>
      ) : null}

      {error ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-[15px]">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Surface>
          <EmptyState
            title="No companies yet"
            description="Run Find companies to fill this inbox, or add a company URL."
            actionLabel={pending ? "Finding…" : "Find companies"}
            pending={pending}
            onAction={() =>
              run(async () => {
                const result = await runDailyPipelineAction();
                return result;
              })
            }
          />
          <div className="border-border border-t px-6 py-5">
            <DiscoverControls />
          </div>
        </Surface>
      ) : (
        <Surface>
          <PanelHeader>
            <Chip id="all" label="All" count={counts.all} />
            <Chip id="new" label="To review" count={counts.new} />
            <Chip id="saved" label="Saved" count={counts.saved} />
          </PanelHeader>

          <ul className="divide-border divide-y">
            {filtered.map((row) => {
              const open = expandedId === row.leadId;
              return (
                <li
                  key={row.leadId}
                  className="row-accent hover:bg-accent-wash/50 group transition-colors duration-150"
                >
                  <div className="flex gap-5 px-8 py-7">
                    <div className="flex w-12 shrink-0 flex-col items-end pt-1">
                      <ScoreMark score={row.score} className="text-[20px]" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/leads/${row.leadId}`}
                          className="text-[17px] font-semibold text-[var(--card-foreground)] transition-colors hover:text-primary"
                        >
                          {row.companyName}
                        </Link>
                        <StatePill state={row.state} />
                        {row.policy !== "draft_allowed" ? (
                          <PolicyPill policy={row.policy} />
                        ) : null}
                      </div>

                      <p className="text-muted-foreground text-[13px]">
                        {[row.domain, row.country].filter(Boolean).join(" · ") ||
                          "Location unknown"}
                      </p>

                      {(row.topNeed || row.oneLiner) && (
                        <p
                          className={cn(
                            "text-[15px] leading-relaxed",
                            open ? "" : "line-clamp-2",
                          )}
                        >
                          {row.topNeed ?? row.oneLiner}
                        </p>
                      )}

                      {open ? (
                        <div className="text-muted-foreground space-y-2 pt-2 text-[13px]">
                          {row.whyFit ? <p>Why it fits: {row.whyFit}</p> : null}
                          {row.unknowns.length > 0 ? (
                            <p className="text-warn">
                              Uncertainty: {row.unknowns.join(" · ")}
                            </p>
                          ) : null}
                          {row.sourceUrl ? (
                            <p>
                              <a
                                className="underline-offset-2 hover:underline"
                                href={row.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {row.sourceName}: {row.sourceTitle}
                              </a>
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {rejectingId === row.leadId ? (
                        <div className="flex flex-wrap items-end gap-2 pt-3">
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reject reason (required)"
                            className="max-w-md"
                            autoFocus
                          />
                          <Button
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
                            Confirm reject
                          </Button>
                          <Button
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

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <Button
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
                          variant="secondary"
                          disabled={pending || !row.hasBrief}
                          onClick={() =>
                            run(() => saveForLaterAction(row.leadId))
                          }
                        >
                          Later
                        </Button>
                        <Button
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
                        className="text-muted-foreground hover:text-[var(--card-foreground)] text-[13px]"
                        onClick={() =>
                          setExpandedId(open ? null : row.leadId)
                        }
                      >
                        {open ? "Less" : "More"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-5 py-12 text-center text-[15px]">
              Nothing in this filter.
            </p>
          ) : null}
        </Surface>
      )}
    </PageShell>
  );
}
