"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  applyLearningProposalAction,
  generateMarketReportAction,
  generatePositioningAction,
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
  const [msg, setMsg] = useState<string | null>(null);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
  ) => {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else {
        setMsg(JSON.stringify(result.data ?? "ok"));
        router.refresh();
      }
    });
  };

  const force = !gatesReady;

  return (
    <div className="space-y-2">
      {!gatesReady ? (
        <p className="text-muted-foreground text-xs">
          Gates not met — actions run as preview (force).
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => run(() => saveSourceReportAction())}
        >
          Source report
        </Button>
        <Button
          disabled={pending}
          onClick={() => run(() => proposeStyleAction(force))}
        >
          Propose style
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => run(() => proposeScoringAction(force))}
        >
          Propose scoring
        </Button>
        <Button
          disabled={pending}
          onClick={() => run(() => generateMarketReportAction(force))}
        >
          Market report
        </Button>
        <Button
          disabled={pending}
          variant="outline"
          onClick={() => run(() => generatePositioningAction(force))}
        >
          Positioning
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {msg ? (
        <p className="text-muted-foreground font-mono text-xs">{msg}</p>
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
        size="lg"
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
        size="lg"
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
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
