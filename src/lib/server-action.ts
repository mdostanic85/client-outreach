import { unstable_rethrow } from "next/navigation";
import { ensureDb } from "@/db/ensure";
import { logger } from "@/lib/logging/logger";
import { currentUserId, requireOwner } from "@/modules/auth/current-user";

/**
 * What every Server Action returns to the client. Errors are plain messages
 * the UI can show; the full error is logged on the server.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Who may call an action.
 * - `user`: any signed-in account; queries scope data to that account.
 * - `owner`: the workspace owner only (client outreach, shared mailbox, API keys, admin).
 */
export type ActionAccess = "user" | "owner";

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Runs `fn` and turns a thrown error into `{ ok: false }` with its message,
 * logging the full error. Next.js control flow (`redirect`, `notFound`) is
 * rethrown, never reported as an error, so a signed-out caller is sent to
 * the welcome screen.
 */
export async function settleAction<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err, action: name }, "server action failed");
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Shared boundary for Server Actions: prepares the database, checks who is
 * calling, then runs the mutation.
 *
 * `fn` must await its mutation before revalidating, so the re-render that
 * ships with the action response reads fresh data.
 */
export async function runAction<T>(
  name: string,
  access: ActionAccess,
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  return settleAction(name, async () => {
    await ensureDb();
    if (access === "owner") await requireOwner();
    else await currentUserId();
    return fn();
  });
}
