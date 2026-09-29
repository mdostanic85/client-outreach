import { AsyncLocalStorage } from "node:async_hooks";
import { asc, eq, type Column } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Whose data a query touches. Web requests resolve it from the session;
 * scripts and background work set it explicitly with `runAsUser`.
 */
const userScope = new AsyncLocalStorage<{ userId: string }>();

export function runAsUser<T>(userId: string, fn: () => T): T {
  return userScope.run({ userId }, fn);
}

export async function currentUserId(): Promise<string> {
  const scoped = userScope.getStore();
  if (scoped) return scoped.userId;
  // Imported lazily so scripts (which never have a request) don't load next/headers.
  const [{ getSessionUser }, { redirect }] = await Promise.all([
    import("@/modules/auth/session"),
    import("next/navigation"),
  ]);
  const user = await getSessionUser();
  // Pages render alongside their layout; send a signed-out visitor to login
  // instead of throwing from whichever data query runs first.
  if (!user) return redirect("/login");
  return user.id;
}

/** `WHERE <table>.user_id = <current user>` — add to every query on a per-account table. */
export async function owned(table: { userId: Column }) {
  return eq(table.userId, await currentUserId());
}

/**
 * The workspace owner: OPTRA_OWNER_EMAIL if set, otherwise the oldest account.
 * Client outreach (one shared mailbox) stays owner-only.
 */
export async function getOwnerUserId(): Promise<string | null> {
  const db = getDb();
  const ownerEmail = process.env.OPTRA_OWNER_EMAIL?.trim().toLowerCase();
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .orderBy(asc(users.createdAt));
  if (ownerEmail) {
    const match = rows.find((row) => row.email.toLowerCase() === ownerEmail);
    if (match) return match.id;
  }
  return rows[0]?.id ?? null;
}

/** Scripts that act for the workspace owner (mailbox, exports, MCP). */
export async function runAsOwner<T>(fn: () => Promise<T>): Promise<T> {
  const ownerId = await getOwnerUserId();
  if (!ownerId) throw new Error("No account yet. Sign up in the app first.");
  return runAsUser(ownerId, fn);
}

export async function isOwner(userId: string): Promise<boolean> {
  return (await getOwnerUserId()) === userId;
}

/**
 * Guard for client-outreach and workspace-admin actions (shared mailbox,
 * API keys). Everyone else only works with their own job-search data.
 */
export async function requireOwner(): Promise<string> {
  const userId = await currentUserId();
  if (!(await isOwner(userId))) {
    throw new Error("Only the workspace owner can do this.");
  }
  return userId;
}

export async function listUserIds(): Promise<string[]> {
  const rows = await getDb().select({ id: users.id }).from(users);
  return rows.map((row) => row.id);
}
