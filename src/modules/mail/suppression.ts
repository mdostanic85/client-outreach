import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, suppressions } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";

export function isSuppressed(email: string, domain?: string | null): boolean {
  const normalized = email.trim().toLowerCase();
  const emailDomain = normalized.includes("@")
    ? normalized.split("@")[1]
    : domain?.toLowerCase() ?? null;

  const rows = getDb().select().from(suppressions).all();
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

export function suppressEmail(email: string, reason: string) {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const domain = normalized.includes("@") ? normalized.split("@")[1] : null;

  const existing = db
    .select()
    .from(suppressions)
    .all()
    .find((s) => s.email?.toLowerCase() === normalized);
  if (existing) return existing.id;

  const id = newId("sup");
  db.insert(suppressions)
    .values({
      id,
      email: normalized,
      domain,
      reason,
      createdAt: nowIso(),
    })
    .run();
  return id;
}

export function companyDomain(companyId: string): string | null {
  return (
    getDb().select().from(companies).where(eq(companies.id, companyId)).get()
      ?.domain ?? null
  );
}

export function assertNotSuppressed(
  email: string,
  companyDomainValue?: string | null,
) {
  if (isSuppressed(email, companyDomainValue)) {
    throw new Error("Recipient or domain is suppressed");
  }
}
