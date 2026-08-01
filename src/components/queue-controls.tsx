"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  processSendQueueAction,
  resumeMailboxAction,
  syncMailboxAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

export function QueueControls({ paused }: { paused: boolean }) {
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
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
