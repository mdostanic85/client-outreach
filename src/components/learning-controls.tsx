"use client";

import { applyLearningProposalAction, generateMarketReportAction, generatePositioningAction, proposeJobScoringAction, proposeScoringAction, proposeStyleAction, rejectLearningProposalAction, saveSourceReportAction } from "@/modules/learning/actions";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";

export function LearningControls({ gatesReady }: { gatesReady: boolean }) {
  const { pending, error, run } = useActionRunner();

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
        <span className="text-destructive text-body-sm">{error}</span>
      ) : null}
    </div>
  );
}

export function ProposalActions({ proposalId }: { proposalId: string }) {
  const { pending, error, run } = useActionRunner();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() => applyLearningProposalAction(proposalId))
        }
      >
        Apply
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => rejectLearningProposalAction(proposalId))
        }
      >
        Reject
      </Button>
      {error ? <span className="text-destructive text-body-sm">{error}</span> : null}
    </div>
  );
}
