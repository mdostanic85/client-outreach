import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, leads, signals } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { fetchArbeitnowSignals } from "./arbeitnow";
import { applyDeterministicFilters, loadTargetFilters, type FilterStats } from "./filters";
import { createManualSignal } from "./manual";
import { fetchRemotiveSignals } from "./remotive";
import { normalizeCompanyName, type DiscoverySignal } from "./types";

export type PersistResult = {
  companyId: string;
  signalId: string;
  leadId: string;
  created: boolean;
  companyKey: string;
};

export async function persistSignal(signal: DiscoverySignal): Promise<PersistResult> {
  const db = getDb();
  const now = nowIso();
  const companyKey =
    signal.companyDomain ?? normalizeCompanyName(signal.companyName);

  const existing = (await db
    .select()
    .from(signals)
    .where(
      and(eq(signals.source, signal.source), eq(signals.externalId, signal.externalId)),
    ).limit(1))[0];

  if (existing) {
    const existingLead = (await db
      .select()
      .from(leads)
      .where(eq(leads.companyId, existing.companyId)).limit(1))[0];
    return {
      companyId: existing.companyId,
      signalId: existing.id,
      leadId: existingLead?.id ?? "",
      created: false,
      companyKey,
    };
  }

  const normalized = normalizeCompanyName(signal.companyName);
  let company = (await db
    .select()
    .from(companies)
    .where(eq(companies.normalizedName, normalized)).limit(1))[0];

  if (!company && signal.companyDomain) {
    company = (await db
      .select()
      .from(companies)
      .where(eq(companies.domain, signal.companyDomain)).limit(1))[0];
  }

  if (company) {
    await db.update(companies)
      .set({
        lastSeenAt: now,
        domain: company.domain ?? signal.companyDomain ?? null,
        country: company.country ?? signal.location ?? null,
      })
      .where(eq(companies.id, company.id));
  } else {
    const companyId = newId("co");
    await db.insert(companies)
      .values({
        id: companyId,
        name: signal.companyName,
        normalizedName: normalized,
        domain: signal.companyDomain ?? null,
        country: signal.location ?? null,
        category: null,
        status: "new",
        firstSeenAt: now,
        lastSeenAt: now,
      });
    company = (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0]!;
  }

  const signalId = newId("sig");
  await db.insert(signals)
    .values({
      id: signalId,
      companyId: company.id,
      source: signal.source,
      externalId: signal.externalId,
      title: signal.title,
      sourceUrl: signal.sourceUrl,
      publishedAt: signal.publishedAt ?? null,
      rawHash: signal.rawHash,
      rawJson: JSON.stringify({
        ...signal,
        descriptionExcerpt:
          "descriptionExcerpt" in signal
            ? (signal as DiscoverySignal & { descriptionExcerpt?: string })
                .descriptionExcerpt
            : undefined,
      }),
      createdAt: now,
    });

  let lead = (await db.select().from(leads).where(eq(leads.companyId, company.id)).limit(1))[0];
  if (!lead) {
    const leadId = newId("lead");
    await db.insert(leads)
      .values({
        id: leadId,
        companyId: company.id,
        state: "new",
        researchStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0]!;
  }

  logger.info(
    { companyId: company.id, signalId, leadId: lead.id, source: signal.source },
    "Persisted discovery signal",
  );

  return {
    companyId: company.id,
    signalId,
    leadId: lead.id,
    created: true,
    companyKey,
  };
}

export async function discoverAndPersistOne(options?: {
  preferDomain?: boolean;
}): Promise<PersistResult | null> {
  const batch = await fetchRemotiveSignals({ limit: 40 });

  const ordered = options?.preferDomain
    ? [...batch].sort((a, b) => Number(!!b.companyDomain) - Number(!!a.companyDomain))
    : batch;

  for (const signal of ordered) {
    const result = await persistSignal(signal);
    if (result.created) return result;
  }

  if (ordered[0]) {
    return await persistSignal(ordered[0]);
  }

  return null;
}

export async function submitManualCompany(input: {
  companyName: string;
  companyUrl: string;
  title?: string;
  location?: string;
}): Promise<PersistResult> {
  const signal = createManualSignal(input);
  return await persistSignal(signal);
}

export type DiscoverBatchResult = {
  rawSignals: DiscoverySignal[];
  filterStats: FilterStats;
  persisted: PersistResult[];
  sourceErrors: Array<{ source: string; error: string }>;
};

/**
 * Fetch Remotive + Arbeitnow, apply deterministic filters, persist kept candidates.
 */
export async function discoverBatch(filtersJson: string): Promise<DiscoverBatchResult> {
  const filters = loadTargetFilters(filtersJson);
  const rawSignals: DiscoverySignal[] = [];
  const sourceErrors: Array<{ source: string; error: string }> = [];

  try {
    rawSignals.push(...(await fetchRemotiveSignals({ limit: 50 })));
  } catch (err) {
    sourceErrors.push({
      source: "remotive",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    rawSignals.push(...(await fetchArbeitnowSignals({ pages: 2, limit: 80 })));
  } catch (err) {
    sourceErrors.push({
      source: "arbeitnow",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const { candidates, stats } = await applyDeterministicFilters(rawSignals, filters);
  const persisted: PersistResult[] = [];

  for (const candidate of candidates) {
    const result = await persistSignal(candidate.signal);
    persisted.push(result);
  }

  return {
    rawSignals,
    filterStats: stats,
    persisted,
    sourceErrors,
  };
}
