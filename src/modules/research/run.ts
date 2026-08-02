import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  companies,
  leads,
  researchBriefs,
  signals,
} from "@/db/schema";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import { loadPrompt, RESEARCH_PROMPT_VERSION } from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { assertPublicBudgetAllows } from "@/lib/budgets";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { retrievePage } from "@/lib/retrieval/fetch-page";
import { retrieveCompanyPages } from "./retrieve";
import {
  calculateScoreTotal,
  EvidenceItemSchema,
  ResearchAndScoreSchema,
  type EvidenceItem,
  type ResearchAndScore,
} from "./schemas";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

export async function researchCompany(companyId: string) {
  assertPublicBudgetAllows("researchAndScore");

  const db = getDb();
  const company = (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company) throw new Error(`Company not found: ${companyId}`);

  const lead = (await db.select().from(leads).where(eq(leads.companyId, companyId)).limit(1))[0];
  if (!lead) throw new Error(`Lead not found for company: ${companyId}`);

  const companySignals = await db
    .select()
    .from(signals)
    .where(eq(signals.companyId, companyId));
  const signal = companySignals[0];

  await db.update(leads)
    .set({ researchStatus: "in_progress", updatedAt: nowIso() })
    .where(eq(leads.id, lead.id));

  const evidence: EvidenceItem[] = [];
  let okPages = 0;

  if (company.domain) {
    const retrieved = await retrieveCompanyPages(companyId, company.domain);
    okPages = retrieved.okCount;
    let idx = 1;
    for (const page of retrieved.pages) {
      if (page.status === "ok" && page.extractedText) {
        evidence.push(
          EvidenceItemSchema.parse({
            id: `e${idx}`,
            url: page.finalUrl,
            pageTitle: page.title ?? undefined,
            retrievedAt: page.retrievedAt,
            excerpt: page.extractedText.slice(0, 2500),
          }),
        );
        idx += 1;
      }
    }
  } else if (signal?.sourceUrl) {
    // No domain — try signal URL as weak evidence only
    const page = await retrievePage(signal.sourceUrl);
    if (page.status === "ok" && page.extractedText) {
      evidence.push(
        EvidenceItemSchema.parse({
          id: "e1",
          url: page.finalUrl,
          pageTitle: page.title ?? undefined,
          retrievedAt: page.retrievedAt,
          excerpt: page.extractedText.slice(0, 2500),
        }),
      );
      okPages = 1;
    }
  }

  if (signal) {
    let excerpt = `Job posting signal: ${signal.title} (source=${signal.source})`;
    try {
      const raw = JSON.parse(signal.rawJson) as {
        descriptionExcerpt?: string;
      };
      if (raw.descriptionExcerpt) {
        excerpt = `Job posting: ${signal.title}\n\n${raw.descriptionExcerpt}`;
      }
    } catch {
      // keep default
    }

    evidence.push(
      EvidenceItemSchema.parse({
        id: `e${evidence.length + 1}`,
        url: signal.sourceUrl,
        pageTitle: signal.title,
        retrievedAt: signal.createdAt,
        excerpt: excerpt.slice(0, 2500),
      }),
    );
  }

  if (evidence.length === 0) {
    await db.update(leads)
      .set({
        researchStatus: "incomplete",
        state: lead.state === "new" ? "suggested" : lead.state,
        updatedAt: nowIso(),
      })
      .where(eq(leads.id, lead.id));
    return {
      briefId: null,
      leadId: lead.id,
      result: null,
      score: null,
      researchStatus: "incomplete" as const,
    };
  }

  const system = loadPrompt("research-and-score.md");
  const user = JSON.stringify(
    {
      company: {
        name: company.name,
        domain: company.domain,
        country: company.country,
      },
      evidence,
      profileHint:
        "Senior product designer offering fractional design leadership, design systems, product redesign.",
    },
    null,
    2,
  );

  const model = resolveModel("researchAndScore");
  let completion = await googleProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "researchAndScore",
    temperature: 0.2,
    jsonMode: true,
  });

  let result: ResearchAndScore;
  try {
    result = ResearchAndScoreSchema.parse(parseJsonLoose(completion.text));
  } catch (firstErr) {
    logger.warn({ err: firstErr }, "Research JSON validation failed — retrying once");
    completion = await googleProvider.complete({
      model,
      messages: buildMessages(
        system,
        `${user}\n\nPrevious response failed schema validation. Return corrected JSON only.`,
      ),
      task: "researchAndScore",
      temperature: 0.1,
      jsonMode: true,
    });
    result = ResearchAndScoreSchema.parse(parseJsonLoose(completion.text));
  }

  const evidenceIds = new Set(evidence.map((e) => e.id));
  result = enforceEvidence(result, evidenceIds);

  const total = calculateScoreTotal(result.score);
  const researchStatus =
    result.recommendedAngle === "insufficient_evidence" || okPages < 1
      ? "incomplete"
      : "complete";

  const briefId = newId("brief");
  await db.insert(researchBriefs)
    .values({
      id: briefId,
      companyId,
      evidenceJson: JSON.stringify(evidence),
      resultJson: JSON.stringify(result),
      model,
      promptVersion: RESEARCH_PROMPT_VERSION,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
      costEstimate: completion.estimatedCost,
      createdAt: nowIso(),
    });

  const nextState =
    lead.state === "new" || lead.state === "researched" ? "suggested" : lead.state;

  await db.update(leads)
    .set({
      score: total,
      scoreBreakdownJson: JSON.stringify({ ...result.score, total }),
      recommendedAngle: result.recommendedAngle,
      recommendedContactRole: result.recommendedContactRole,
      researchStatus,
      state: nextState,
      updatedAt: nowIso(),
    })
    .where(eq(leads.id, lead.id));

  logger.info(
    { companyId, leadId: lead.id, score: total, researchStatus },
    "Research complete",
  );

  return { briefId, leadId: lead.id, result, score: total, researchStatus };
}

function enforceEvidence(
  result: ResearchAndScore,
  evidenceIds: Set<string>,
): ResearchAndScore {
  const risks = [...result.risksAndUnknowns];
  const needs = result.currentNeedSignals.filter((item) => {
    const ok = item.evidenceIds.some((id) => evidenceIds.has(id));
    if (!ok) risks.push(`Unsupported need claim moved: ${item.claim}`);
    return ok;
  });
  const fits = result.fitReasons.filter((item) => {
    const ok = item.evidenceIds.some((id) => evidenceIds.has(id));
    if (!ok) risks.push(`Unsupported fit reason moved: ${item.reason}`);
    return ok;
  });
  return {
    ...result,
    currentNeedSignals: needs,
    fitReasons: fits,
    risksAndUnknowns: risks,
  };
}
