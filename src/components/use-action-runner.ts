"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

/** Any Server Action result: `ActionResult` or a step that returns one. */
type RunnableResult = { ok: boolean; error?: string };

export type RunOptions = {
  /** Shown as the info message when the action succeeds. */
  success?: string;
  /** Runs after a successful action, before the refresh. */
  onSuccess?: () => void;
  /** Navigate here instead of refreshing the current route. */
  goTo?: string;
};

/**
 * The client half of a mutation: runs a Server Action in a transition,
 * shows its error or a success message, then refreshes (or navigates) so
 * the page reads the new server state.
 */
export function useActionRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    (fn: () => Promise<RunnableResult>, options: RunOptions = {}) => {
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const result = await fn();
        if (!result.ok) {
          setError(result.error || "Something went wrong. Try again.");
          return;
        }
        options.onSuccess?.();
        if (options.success) setMessage(options.success);
        if (options.goTo) router.push(options.goTo);
        else router.refresh();
      });
    },
    [router],
  );

  return { pending, error, message, setError, setMessage, run };
}

export type ActionRunner = ReturnType<typeof useActionRunner>;
