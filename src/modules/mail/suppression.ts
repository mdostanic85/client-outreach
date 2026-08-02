import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, suppressions } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";

export async function isSuppressed(email: string, domain?: string | null): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const emailDomain = normalized.includes("@")
    ? normalized.split("@")[1]
    : domain?.toLowerCase() ?? null;

  const rows = await getDb().select().from(suppressions);
  for (const row of rows) {
    if (row.email && row.email.trim().toLowerCase() === normalized) return true;
    if (
      row.domain &&
      emailDomain &&
      row.domain.trim().toLowerCase() === emailDomain
    ) {
      return true;
    }
  }
  return false;
}

export async function suppressEmail(email: string, reason: string) {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const domain = normalized.includes("@") ? normalized.split("@")[1] : null;

  const existing = (await db
    .select()
    .from(suppressions))
    .find((s) => s.email?.toLowerCase() === normalized);
  if (existing) return existing.id;

  const id = newId("sup");
  await db.insert(suppressions)
    .values({
      id,
      email: normalized,
      domain,
      reason,
      createdAt: nowIso(),
    });
  return id;
}

export async function companyDomain(companyId: string): Promise<string | null> {
  return (
    (await getDb().select().from(companies).where(eq(companies.id, companyId)).limit(1))[0]
      ?.domain ?? null
  );
}

export async function assertNotSuppressed(
  email: string,
  companyDomainValue?: string | null,
) {
  if (await isSuppressed(email, companyDomainValue)) {
    throw new Error("Recipient or domain is suppressed");
  }
}
