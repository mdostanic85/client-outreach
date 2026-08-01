import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leads } from "@/db/schema";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import { loadPrompt, TRIAGE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import type { FilteredCandidate } from "./filters";
import { TriageBatchSchema, type TriageResult } from "./triage-schema";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

export type TriageOutcome = {
  results: TriageResult[];
  failedKeys: string[];
  kept: FilteredCandidate[];
  rejected: FilteredCandidate[];
  failed: FilteredCandidate[];
};

/**
 * Batch public-model triage of normalized candidates.
 * Failed validation → one retry; still-failed → triage_failed (visible, not discarded).
 */
export async function triageCandidatesBatch(
  candidates: FilteredCandidate[],
  options?: { batchSize?: number; leadIdsByCompanyKey?: Map<string, string> },
): Promise<TriageOutcome> {
  const batchSize = options?.batchSize ?? 15;
  const allResults: TriageResult[] = [];
  const failedKeys: string[] = [];

  const system = loadPrompt("triage.md");
  const model = resolveModel("triage");

  for (let i = 0; i < candidates.length; i += batchSize) {
    const chunk = candidates.slice(i, i + batchSize);
    const payload = chunk.map((c) => ({
      companyKey: c.companyKey,
      companyName: c.signal.companyName,
      domain: c.domain,
      title: c.signal.title,
      location: c.signal.location,
      source: c.signal.source,
      sourceUrl: c.signal.sourceUrl,
    }));

    const user = JSON.stringify({ candidates: payload }, null, 2);
    let results: TriageResult[] = [];

    try {
      let completion = await googleProvider.complete({
        model,
        messages: buildMessages(system, user),
        task: "triage",
        temperature: 0.1,
        jsonMode: true,
      });

      try {
        results = TriageBatchSchema.parse(parseJsonLoose(completion.text));
      } catch (firstErr) {
        logger.warn({ err: firstErr }, "Triage JSON validation failed — retrying once");
        completion = await googleProvider.complete({
          model,
          messages: buildMessages(
            system,
            `${user}\n\nPrevious response failed schema validation. Return corrected JSON array only.`,
          ),
          task: "triage",
          temperature: 0.05,
          jsonMode: true,
        });
        results = TriageBatchSchema.parse(parseJsonLoose(completion.text));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Config / auth failures are systemic — fail the pipeline so the UI
      // surfaces the error instead of silently parking every lead as triage_failed.
      if (
        message.includes("Missing secret") ||
        /Google LLM error 40[013]/.test(message)
      ) {
        throw err instanceof Error ? err : new Error(message);
      }

      logger.error({ err }, "Triage batch failed");
      for (const c of chunk) {
        failedKeys.push(c.companyKey);
        const leadId = options?.leadIdsByCompanyKey?.get(c.companyKey);
        if (leadId) {
          getDb()
            .update(leads)
            .set({ state: "triage_failed", updatedAt: nowIso() })
            .where(eq(leads.id, leadId))
            .run();
        }
      }
      continue;
    }

    const byKey = new Map(results.map((r) => [r.companyKey, r]));
    for (const c of chunk) {
      const result = byKey.get(c.companyKey);
      if (!result) {
        failedKeys.push(c.companyKey);
        const leadId = options?.leadIdsByCompanyKey?.get(c.companyKey);
        if (leadId) {
          getDb()
            .update(leads)
            .set({ state: "triage_failed", updatedAt: nowIso() })
            .where(eq(leads.id, leadId))
            .run();
        }
        continue;
      }
      allResults.push(result);
    }
  }

  const resultMap = new Map(allResults.map((r) => [r.companyKey, r]));
  const kept: FilteredCandidate[] = [];
  const rejected: FilteredCandidate[] = [];
  const failed: FilteredCandidate[] = [];

  for (const c of candidates) {
    if (failedKeys.includes(c.companyKey)) {
      failed.push(c);
      continue;
    }
    const r = resultMap.get(c.companyKey);
    if (r?.keep) kept.push(c);
    else rejected.push(c);
  }

  logger.info(
    {
      promptVersion: TRIAGE_PROMPT_VERSION,
      kept: kept.length,
      rejected: rejected.length,
      failed: failed.length,
    },
    "Triage batch complete",
  );

  return { results: allResults, failedKeys, kept, rejected, failed };
}
