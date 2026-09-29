"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  applyLearningProposalAction,
  generateMarketReportAction,
  generatePositioningAction,
  proposeJobScoringAction,
  proposeScoringAction,
  proposeStyleAction,
  rejectLearningProposalAction,
  saveSourceReportAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

export function LearningControls({ gatesReady }: { gatesReady: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else router.refresh();
    });
  };

  const force = !gatesReady;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="xs"
        disabled={pending}
        variant="secondary"
        onClick={() => run(() => saveSourceReportAction())}
      >
        Source report
      </Button>
      <Button
        size="xs"
        disabled={pending}
        onClick={() => run(() => proposeStyleAction(force))}
      >
        Style
      </Button>
      <Button
        size="xs"
        disabled={pending}
        variant="secondary"
        onClick={() => run(() => proposeScoringAction(force))}
      >
        Outreach scoring
      </Button>
      <Button
        size="xs"
        disabled={pending}
        variant="secondary"
        onClick={() => run(() => proposeJobScoringAction(force))}
      >
        Job scoring
      </Button>
      <Button
        size="xs"
        disabled={pending}
        onClick={() => run(() => generateMarketReportAction(force))}
      >
        Market
      </Button>
      <Button
        size="xs"
        disabled={pending}
        variant="outline"
        onClick={() => run(() => generatePositioningAction(force))}
      >
        Positioning
      </Button>
      {error ? (
        <span className="text-destructive text-[14px]">{error}</span>
      ) : null}
    </div>
  );
}

export function ProposalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await applyLearningProposalAction(proposalId);
            if (!r.ok) setError(r.error ?? "Failed");
            else router.refresh();
          })
        }
      >
        Apply
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await rejectLearningProposalAction(proposalId);
            if (!r.ok) setError(r.error ?? "Failed");
            else router.refresh();
          })
        }
      >
        Reject
      </Button>
      {error ? <span className="text-destructive text-[14px]">{error}</span> : null}
    </div>
  );
}
