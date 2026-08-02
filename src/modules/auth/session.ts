import { cookies } from "next/headers";
import { eq, and, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  RESET_TOKEN_MINUTES,
} from "@/modules/auth/constants";
import {
  hashPassword,
  hashToken,
  newResetToken,
  newSessionToken,
  verifyPassword,
} from "@/modules/auth/crypto";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

function sessionExpiryIso(days = SESSION_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function resetExpiryIso() {
  return new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString();
}

export async function countUsers() {
  return (await getDb().select().from(users)).length;
}

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return (
    (await getDb()
      .select()
      .from(users)
      .where(eq(users.email, normalized)).limit(1))[0] ?? null
  );
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = nowIso();
  const row = (await getDb()
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now))).limit(1))[0];

  if (!row) return null;
  return { id: row.userId, email: row.email, name: row.name };
}

export async function createSession(userId: string) {
  const token = newSessionToken();
  const now = nowIso();
  await getDb()
    .insert(sessions)
    .values({
      id: newId("ses"),
      userId,
      tokenHash: hashToken(token),
      expiresAt: sessionExpiryIso(),
      createdAt: now,
    });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Only force Secure on real HTTPS hosts (Vercel). Local `next start`
    // uses NODE_ENV=production over http://127.0.0.1 and would drop the cookie.
    secure: process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb()
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: 0,
  });
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const now = nowIso();
  const id = newId("usr");
  await getDb()
    .insert(users)
    .values({
      id,
      email,
      name: input.name?.trim() || null,
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    });
  return { id, email, name: input.name?.trim() || null };
}

export async function authenticateUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, email: user.email, name: user.name };
}

/** Local-first: returns a reset URL fragment (no email provider yet). */
export async function issuePasswordReset(email: string): Promise<{
  ok: true;
  resetPath?: string;
} | { ok: false; error: string }> {
  const user = await findUserByEmail(email);
  // Always succeed from the caller's view to avoid email enumeration.
  if (!user) return { ok: true };

  const token = newResetToken();
  const now = nowIso();
  await getDb()
    .insert(passwordResetTokens)
    .values({
      id: newId("prt"),
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: resetExpiryIso(),
      usedAt: null,
      createdAt: now,
    });

  return { ok: true, resetPath: `/reset-password?token=${token}` };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const now = nowIso();
  const row = (await getDb()
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(token)),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt),
      ),
    ).limit(1))[0];

  if (!row) return { ok: false as const, error: "This reset link is invalid or expired." };

  await getDb()
    .update(users)
    .set({ passwordHash: hashPassword(password), updatedAt: now })
    .where(eq(users.id, row.userId));

  await getDb()
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, row.id));

  // Invalidate existing sessions for that user.
  await getDb().delete(sessions).where(eq(sessions.userId, row.userId));

  return { ok: true as const, userId: row.userId };
}
