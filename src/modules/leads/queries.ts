import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import {
  apiUsage,
  companies,
  contacts,
  drafts,
  leads,
  researchBriefs,
  signals,
  sourcePages,
  syncRuns,
} from "@/db/schema";
import { getBudgetStatus } from "@/lib/budgets";
import { resolveCountryPolicy } from "@/lib/policy/country";
import { buildLookupLinks } from "@/modules/contacts/lookup";
import { getLeadMailDetail } from "@/modules/mail/queries";
import type { EvidenceItem, ResearchAndScore } from "@/modules/research/schemas";
import { getUserSettings } from "@/modules/settings/user-settings";
import { owned } from "@/modules/auth/current-user";

export async function listLeads() {
  const db = await ensureDb();
  return await db
    .select({
      lead: leads,
      company: companies,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .orderBy(desc(leads.updatedAt));
}

/** Daily ranked review list: suggested / researched, highest score first. */
export async function listDailyLeads(limit = 15) {
  const db = await ensureDb();
  const rows = (await db
    .select({
      lead: leads,
      company: companies,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .where(inArray(leads.state, ["suggested", "researched", "saved_for_later"])))
    .sort((a, b) => (b.lead.score ?? 0) - (a.lead.score ?? 0))
    .slice(0, limit);

  return Promise.all(
    rows.map(async ({ lead, company }) => {
    const brief = (await db
      .select()
      .from(researchBriefs)
      .where(eq(researchBriefs.companyId, company.id))
      .orderBy(desc(researchBriefs.createdAt)).limit(1))[0];

    const result = brief
      ? (JSON.parse(brief.resultJson) as ResearchAndScore)
      : null;
    const companySignals = await db
      .select()
      .from(signals)
      .where(eq(signals.companyId, company.id));

    const need =
      result?.currentNeedSignals?.sort((a, b) => {
        const rank = { strong: 3, medium: 2, weak: 1 };
        return rank[b.strength] - rank[a.strength];
      })[0]?.claim ?? null;

    const fit = result?.fitReasons?.[0]?.reason ?? null;
    const policy = await resolveCountryPolicy(company.country);

    return {
      lead,
      company,
      oneLiner: result?.companySummary ?? null,
      topNeed: need,
      whyFit: fit,
      unknowns: result?.risksAndUnknowns?.slice(0, 3) ?? [],
      sources: companySignals.map((s) => ({
        title: s.title,
        url: s.sourceUrl,
        source: s.source,
      })),
      policy,
      hasBrief: Boolean(brief && result),
    };
  }),
  );
}

export async function getLeadDetail(leadId: string) {
  const db = await ensureDb();
  const row = (await db
    .select({
      lead: leads,
      company: companies,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .where(eq(leads.id, leadId)).limit(1))[0];

  if (!row) return null;

  const companySignals = await db
    .select()
    .from(signals)
    .where(eq(signals.companyId, row.company.id));

  const pages = await db
    .select()
    .from(sourcePages)
    .where(eq(sourcePages.companyId, row.company.id));

  const briefRow = (await db
    .select()
    .from(researchBriefs)
    .where(eq(researchBriefs.companyId, row.company.id))
    .orderBy(desc(researchBriefs.createdAt)).limit(1))[0];

  const companyContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, row.company.id));

  const leadDrafts = await db
    .select()
    .from(drafts)
    .where(eq(drafts.leadId, leadId))
    .orderBy(desc(drafts.createdAt));

  const usage = await db
    .select()
    .from(apiUsage)
    .where(await owned(apiUsage)).orderBy(desc(apiUsage.occurredAt))
    .limit(20);

  const policy = await resolveCountryPolicy(row.company.country);
  const mail = await getLeadMailDetail(leadId);
  const lookupLinks = buildLookupLinks({
    companyName: row.company.name,
    domain: row.company.domain,
  });

  return {
    ...row,
    signals: companySignals,
    pages,
    brief: briefRow
      ? {
          ...briefRow,
          evidence: JSON.parse(briefRow.evidenceJson) as EvidenceItem[],
          result: JSON.parse(briefRow.resultJson) as ResearchAndScore,
        }
      : null,
    contacts: companyContacts,
    drafts: leadDrafts,
    recentUsage: usage,
    policy,
    mail,
    lookupLinks,
  };
}

export async function getAdminOverview() {
  const db = await ensureDb();
  const latestRun = (await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1))[0];

  const stateCounts = await db
    .select({
      state: leads.state,
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .groupBy(leads.state);

  const rejectReasons = (await db
    .select({
      reason: leads.rejectReason,
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(eq(leads.state, "rejected"))
    .groupBy(leads.rejectReason))
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 10);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const usageByTask = await db
    .select({
      task: apiUsage.task,
      provider: apiUsage.provider,
      cost: sql<number>`coalesce(sum(${apiUsage.estimatedCost}), 0)`,
      tokensIn: sql<number>`coalesce(sum(${apiUsage.inputTokens}), 0)`,
      tokensOut: sql<number>`coalesce(sum(${apiUsage.outputTokens}), 0)`,
    })
    .from(apiUsage)
    .where(and(await owned(apiUsage), gte(apiUsage.occurredAt, monthStart.toISOString())))
    .groupBy(apiUsage.task, apiUsage.provider);

  const setting = (await getUserSettings());
  const budget = await getBudgetStatus();

  const triageFailed = stateCounts.find((s) => s.state === "triage_failed")?.count ?? 0;
  const incomplete = (await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.researchStatus, "incomplete")).limit(1))[0]?.count ?? 0;

  return {
    latestRun,
    stateCounts,
    rejectReasons,
    usageByTask,
    budget,
    setting,
    triageFailed: Number(triageFailed),
    incompleteBriefs: Number(incomplete),
    manualActions: [
      Number(triageFailed) > 0 ? `${triageFailed} triage_failed leads` : null,
      Number(incomplete) > 0 ? `${incomplete} incomplete research briefs` : null,
      budget.alerts.length > 0
        ? `Budget alerts: ${budget.alerts.join(", ")}`
        : null,
      latestRun && !latestRun.finishedAt ? "Latest sync run still open / failed" : null,
      latestRun?.error ? `Latest run error: ${latestRun.error}` : null,
    ].filter(Boolean) as string[],
  };
}

export async function getSettingsRow() {
  await ensureDb();
  return (await getUserSettings()) ?? null;
}
