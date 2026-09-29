import { cache } from "react";
import { headers } from "next/headers";
import { count } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getAuth } from "@/modules/auth/auth";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  onboardingCompletedAt: string | null;
};

export async function countUsers() {
  const [row] = await getDb().select({ value: count() }).from(users);
  return row?.value ?? 0;
}

export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    onboardingCompletedAt: user.onboardingCompletedAt ?? null,
  };
});
