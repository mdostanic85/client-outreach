/**
 * Phase 1 / AI routing — research factuality scorecard.
 * Exports existing research briefs for human labeling (first 50 companies).
 * Does not re-call models by default (cost control).
 *
 * Usage: npx tsx tests/evals/research-scorecard.ts [--limit 50]
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { ensureDb } from "../../src/db/ensure";
import { getDb } from "../../src/db/client";
import { companies, leads, researchBriefs } from "../../src/db/schema";

function parseArgs() {
  const limitIdx = process.argv.indexOf("--limit");
  return { limit: limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) || 50 : 50 };
}

function main() {
  const { limit } = parseArgs();
  ensureDb();
  const db = getDb();

  const briefs = db
    .select()
    .from(researchBriefs)
    .all()
    .slice(-limit);

  const rows = briefs.map((brief) => {
    const company = db
      .select()
      .from(companies)
      .where(eq(companies.id, brief.companyId))
      .get();
    const lead = db
      .select()
      .from(leads)
      .where(eq(leads.companyId, brief.companyId))
      .get();

    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(brief.resultJson || "{}") as Record<string, unknown>;
    } catch {
      result = {};
    }

    return {
      briefId: brief.id,
      companyId: brief.companyId,
      companyName: company?.name ?? "",
      domain: company?.domain ?? null,
      leadState: lead?.state ?? null,
      score: lead?.score ?? null,
      model: brief.model,
      promptVersion: brief.promptVersion,
      researchStatus: lead?.researchStatus ?? null,
      resultSummary: {
        needNow: result.needNow ?? result.need_now ?? null,
        angle: result.outreachAngle ?? result.angle ?? lead?.recommendedAngle,
        incomplete: result.incomplete ?? lead?.researchStatus === "incomplete",
      },
      // Human labels (fill offline)
      keepDropCorrect: null as boolean | null,
      claimsSupported: null as boolean | null,
      usefulNeedNow: null as boolean | null,
      usefulAngle: null as boolean | null,
      fabricatedDetails: null as boolean | null,
      notes: "",
    };
  });

  const outDir = path.join(process.cwd(), "data", "evals");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `research-scorecard-${stamp}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        instructions:
          "Score first 50 researched companies. Target unsupported claims <5%. Decide whether to keep cheap research model.",
        rows,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(`Wrote ${rows.length} rows → ${outPath}`);
}

main();
