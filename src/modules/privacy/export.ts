import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  activities,
  companies,
  contacts,
  deliveryEvents,
  drafts,
  leads,
  messages,
  profileSources,
  researchBriefs,
  signals,
  structuredProfiles,
  suppressions,
  threads,
} from "@/db/schema";
import { nowIso } from "@/lib/ids";

export type PersonalDataExport = {
  exportedAt: string;
  companies: unknown[];
  leads: unknown[];
  contacts: unknown[];
  drafts: unknown[];
  activities: unknown[];
  threads: unknown[];
  messages: unknown[];
  deliveryEvents: unknown[];
  researchBriefs: unknown[];
  signals: Array<{
    id: string;
    companyId: string;
    source: string;
    externalId: string;
    title: string;
    sourceUrl: string;
    publishedAt: string | null;
    createdAt: string;
    /** raw_json omitted by default — request includeRaw if needed */
  }>;
  suppressions: unknown[];
  profileSources?: unknown[];
  structuredProfiles?: unknown[];
};

/** Full personal/business contact export. Does not include API keys or mail credentials. */
export async function buildPersonalDataExport(options?: {
  companyId?: string;
  leadId?: string;
  includeRawSignals?: boolean;
}): Promise<PersonalDataExport> {
  const db = getDb();
  const companyId = options?.companyId;
  const leadId = options?.leadId;

  let leadRows = await db.select().from(leads);
  if (leadId) leadRows = leadRows.filter((l) => l.id === leadId);
  if (companyId) leadRows = leadRows.filter((l) => l.companyId === companyId);

  const leadIds = new Set(leadRows.map((l) => l.id));
  const companyIds = new Set(leadRows.map((l) => l.companyId));
  if (companyId) companyIds.add(companyId);

  const companyRows = (await db
    .select()
    .from(companies))
    .filter((c) => companyIds.size === 0 || companyIds.has(c.id));

  // When exporting everything (no filter), include all companies/contacts
  const exportAll = !companyId && !leadId;
  const companiesOut = exportAll ? await db.select().from(companies) : companyRows;
  const companyIdSet = new Set(companiesOut.map((c) => c.id));

  const contactRows = (await db
    .select()
    .from(contacts))
    .filter((c) => companyIdSet.has(c.companyId));

  const draftRows = (await db
    .select()
    .from(drafts))
    .filter((d) => exportAll || leadIds.has(d.leadId));

  const activityRows = (await db
    .select()
    .from(activities))
    .filter((a) => exportAll || leadIds.has(a.leadId));

  const threadRows = (await db
    .select()
    .from(threads))
    .filter((t) => exportAll || leadIds.has(t.leadId));

  const messageRows = (await db
    .select()
    .from(messages))
    .filter((m) => exportAll || leadIds.has(m.leadId));

  const deliveryRows = (await db
    .select()
    .from(deliveryEvents))
    .filter((e) => exportAll || (e.leadId != null && leadIds.has(e.leadId)));

  const briefRows = (await db
    .select()
    .from(researchBriefs))
    .filter((b) => companyIdSet.has(b.companyId));

  const signalRows = (await db
    .select()
    .from(signals))
    .filter((s) => companyIdSet.has(s.companyId))
    .map((s) => ({
      id: s.id,
      companyId: s.companyId,
      source: s.source,
      externalId: s.externalId,
      title: s.title,
      sourceUrl: s.sourceUrl,
      publishedAt: s.publishedAt,
      createdAt: s.createdAt,
      ...(options?.includeRawSignals ? { rawJson: s.rawJson } : {}),
    }));

  return {
    exportedAt: nowIso(),
    companies: companiesOut,
    leads: exportAll ? await db.select().from(leads) : leadRows,
    contacts: contactRows,
    drafts: draftRows,
    activities: activityRows,
    threads: threadRows,
    messages: messageRows,
    deliveryEvents: deliveryRows,
    researchBriefs: briefRows,
    signals: signalRows,
    suppressions: await db.select().from(suppressions),
    ...(exportAll
      ? {
          profileSources: await db.select().from(profileSources),
          structuredProfiles: await db.select().from(structuredProfiles),
        }
      : {}),
  };
}

export async function writePersonalDataExport(options?: {
  companyId?: string;
  leadId?: string;
  includeRawSignals?: boolean;
}): Promise<{ path: string; bytes: number }> {
  const payload = await buildPersonalDataExport(options);
  const dir = path.join(process.cwd(), "data", "exports");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const scope = options?.leadId
    ? `lead-${options.leadId}`
    : options?.companyId
      ? `company-${options.companyId}`
      : "all";
  const filePath = path.join(dir, `export-${scope}-${stamp}.json`);
  const text = JSON.stringify(payload, null, 2);
  fs.writeFileSync(filePath, text, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
  return { path: filePath, bytes: Buffer.byteLength(text) };
}

export async function getLeadCompanyId(leadId: string): Promise<string | null> {
  return (
    (await getDb().select().from(leads).where(eq(leads.id, leadId)).limit(1))[0]?.companyId ??
    null
  );
}
