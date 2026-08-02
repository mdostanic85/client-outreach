"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import {
  markJobAppliedAction,
  rejectJobAction,
  saveJobForLaterAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { InlineAlert } from "@/components/inline-alert";
import { JobListItem } from "@/components/job-list-item";
import type { JobTriageRow } from "@/components/jobs-inbox";
import { Stagger, StaggerItem } from "@/components/motion";
import {
  PageHeader,
  PageShell,
  Surface,
} from "@/components/page-shell";

/**
 * Interested / saved jobs list — Braintrust "Your saved items"
 * + Peerlist SAVED / APPLIED tab pattern (Mobbin).
 */
export function InterestedJobs({ rows }: { rows: JobTriageRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else router.refresh();
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Interested"
        description="Roles you marked as a fit. Open the posting, mark applied, or move them back to Today with Save."
        meta={`${rows.length} role${rows.length === 1 ? "" : "s"}`}
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      {rows.length === 0 ? (
        <Surface>
          <EmptyState
            title="No interested roles yet"
            description="On Today · Jobs, expand a match and click Interested. They’ll show up here."
            icon={
              <Bookmark className="size-6 opacity-70" strokeWidth={1.5} />
            }
            actionLabel="Back to Today"
            onAction={() => router.push("/")}
          />
        </Surface>
      ) : (
        <Stagger as="ul" className="space-y-3">
          {rows.map((row, index) => (
            <StaggerItem key={row.jobId} as="li" index={index}>
              <JobListItem
                variant="interested"
                row={row}
                expanded={expandedId === row.jobId}
                pending={pending}
                rejecting={rejectingId === row.jobId}
                rejectReason={rejectReason}
                onToggle={() =>
                  setExpandedId(
                    expandedId === row.jobId ? null : row.jobId,
                  )
                }
                onMarkApplied={() =>
                  run(async () => markJobAppliedAction(row.jobId))
                }
                onMoveToToday={() =>
                  run(async () => saveJobForLaterAction(row.jobId))
                }
                onStartReject={() => {
                  setRejectingId(row.jobId);
                  setRejectReason("");
                }}
                onRejectReason={setRejectReason}
                onConfirmReject={() =>
                  run(async () => {
                    const res = await rejectJobAction(
                      row.jobId,
                      rejectReason.trim() || "Changed mind",
                    );
                    setRejectingId(null);
                    setRejectReason("");
                    return res;
                  })
                }
                onCancelReject={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </PageShell>
  );
}
