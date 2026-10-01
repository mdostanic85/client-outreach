"use client";

import { processSendQueueAction, resumeMailboxAction, syncMailboxAction } from "@/modules/mail/actions";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";

export function QueueControls({ paused }: { paused: boolean }) {
  const { pending, error, run } = useActionRunner();


  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => processSendQueueAction())}
        >
          Process queue
        </Button>
        <Button
          size="lg"
          disabled={pending}
          variant="secondary"
          onClick={() => run(() => syncMailboxAction())}
        >
          Sync replies
        </Button>
        {paused ? (
          <Button
            size="lg"
            disabled={pending}
            variant="outline"
            onClick={() => run(() => resumeMailboxAction())}
          >
            Resume
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-destructive text-body-sm">{error}</p> : null}
    </div>
  );
}
