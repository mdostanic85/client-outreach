import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import {
  apiUsage,
  companies,
  contacts,
  drafts,
  leads,
  researchBriefs,
  settings,
  signals,
  sourcePages,
  syncRuns,
} from "@/db/schema";
import { getBudgetStatus } from "@/lib/budgets";
import { resolveCountryPolicy } from "@/lib/policy/country";
import { buildLookupLinks } from "@/modules/contacts/lookup";
import { getLeadMailDetail } from "@/modules/mail/queries";
import type { EvidenceItem, ResearchAndScore } from "@/modules/research/schemas";

export function listLeads() {
  const db = ensureDb();
  return db
    .select({
      lead: leads,
      company: companies,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .orderBy(desc(leads.updatedAt))
    .all();
}

/** Daily ranked review list: suggested / researched, highest score first. */
export function listDailyLeads(limit = 15) {
  const db = ensureDb();
  const rows = db
    .select({
      lead: leads,
      company: companies,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .where(inArray(leads.state, ["suggested", "researched", "saved_for_later"]))
    .all()
    .sort((a, b) => (b.lead.score ?? 0) - (a.lead.score ?? 0))
    .slice(0, limit);

  return rows.map(({ lead, company }) => {
    const brief = db
      .select()
      .from(researchBriefs)
      .where(eq(researchBriefs.companyId, company.id))
      .orderBy(desc(researchBriefs.createdAt))
      .all()[0];

    const result = brief
      ? (JSON.parse(brief.resultJson) as ResearchAndScore)
      : null;
    const companySignals = db
      .select()
      .from(signals)
      .where(eq(signals.companyId, company.id))
      .all();

    const need =
      result?.currentNeedSignals?.sort((a, b) => {
        const rank = { strong: 3, medium: 2, weak: 1 };
        return rank[b.strength] - rank[a.strength];
      })[0]?.claim ?? null;

    const fit = result?.fitReasons?.[0]?.reason ?? null;
    const policy = resolveCountryPolicy(company.country);

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
  });
}

export function getLeadDetail(leadId: string) {
  const db = ensureDb();
  const row = db
    .select({
      lead: leads,
      company: companies,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .where(eq(leads.id, leadId))
    .get();

  if (!row) return null;

  const companySignals = db
    .select()
    .from(signals)
    .where(eq(signals.companyId, row.company.id))
    .all();

  const pages = db
    .select()
    .from(sourcePages)
    .where(eq(sourcePages.companyId, row.company.id))
    .all();

  const briefRow = db
    .select()
    .from(researchBriefs)
    .where(eq(researchBriefs.companyId, row.company.id))
    .orderBy(desc(researchBriefs.createdAt))
    .all()[0];

  const companyContacts = db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, row.company.id))
    .all();

  const leadDrafts = db
    .select()
    .from(drafts)
    .where(eq(drafts.leadId, leadId))
    .orderBy(desc(drafts.createdAt))
    .all();

  const usage = db
    .select()
    .from(apiUsage)
    .orderBy(desc(apiUsage.occurredAt))
    .limit(20)
    .all();

  const policy = resolveCountryPolicy(row.company.country);
  const mail = getLeadMailDetail(leadId);
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

export function getAdminOverview() {
  const db = ensureDb();
  const latestRun = db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1)
    .all()[0];

  const stateCounts = db
    .select({
      state: leads.state,
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .groupBy(leads.state)
    .all();

  const rejectReasons = db
    .select({
      reason: leads.rejectReason,
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(eq(leads.state, "rejected"))
    .groupBy(leads.rejectReason)
    .all()
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 10);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const usageByTask = db
    .select({
      task: apiUsage.task,
      provider: apiUsage.provider,
      cost: sql<number>`coalesce(sum(${apiUsage.estimatedCost}), 0)`,
      tokensIn: sql<number>`coalesce(sum(${apiUsage.inputTokens}), 0)`,
      tokensOut: sql<number>`coalesce(sum(${apiUsage.outputTokens}), 0)`,
    })
    .from(apiUsage)
    .where(gte(apiUsage.occurredAt, monthStart.toISOString()))
    .groupBy(apiUsage.task, apiUsage.provider)
    .all();

  const setting = db.select().from(settings).all()[0];
  const budget = getBudgetStatus();

  const triageFailed = stateCounts.find((s) => s.state === "triage_failed")?.count ?? 0;
  const incomplete = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.researchStatus, "incomplete"))
    .get()?.count ?? 0;

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

export function getSettingsRow() {
  const db = ensureDb();
  return db.select().from(settings).all()[0] ?? null;
}
