/**
 * Phase 2 writing-model comparison harness.
 *
 * For each accepted lead (up to 20), generates draft candidates with
 * configured models and writes a scorecard JSON for human review.
 *
 * Does NOT auto-pick a winner — fill human scores offline.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=… npx tsx tests/evals/writing-compare.ts
 *   npx tsx tests/evals/writing-compare.ts --limit 5 --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { ensureDb } from "../../src/db/ensure";
import { getDb } from "../../src/db/client";
import {
  companies,
  contacts,
  drafts,
  leads,
  researchBriefs,
} from "../../src/db/schema";
import { anthropicProvider } from "../../src/lib/ai/anthropic";
import { buildMessages } from "../../src/lib/ai/google";
import {
  EMAIL_PROMPT_VERSION,
  loadPrompt,
} from "../../src/lib/ai/prompts";
import { editRatio } from "../../src/modules/learning/diff";
import { checkDraftQuality } from "../../src/modules/outreach/quality";
import { z } from "zod";

const DraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

/** Models to compare for first 20 accepted leads (Phase 2 / AI routing gate). */
export const WRITING_COMPARE_MODELS = [
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
] as const;

export type WritingEvalRow = {
  leadId: string;
  companyName: string;
  domain: string | null;
  model: string;
  subject: string;
  body: string;
  qualityOk: boolean;
  qualityCodes: string[];
  /** Fill after editing the chosen draft */
  editPercentage?: number;
  humanSounding?: number;
  specificity?: number;
  pushiness?: number;
  clarity?: number;
  minutesToFinal?: number;
  notes?: string;
};

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

async function draftWithModel(input: {
  model: string;
  system: string;
  user: string;
}): Promise<{ subject: string; body: string }> {
  const completion = await anthropicProvider.complete({
    model: input.model,
    messages: buildMessages(input.system, input.user),
    task: "draftMessage",
    temperature: 0.4,
  });
  return DraftSchema.parse(parseJsonLoose(completion.text));
}

function parseArgs() {
  const limitIdx = process.argv.indexOf("--limit");
  const limit =
    limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) || 20 : 20;
  const dryRun = process.argv.includes("--dry-run");
  return { limit, dryRun };
}

async function main() {
  const { limit, dryRun } = parseArgs();
  ensureDb();
  const db = getDb();

  const accepted = db
    .select()
    .from(leads)
    .all()
    .filter((l) =>
      ["accepted", "draft_ready", "sent", "replied"].includes(l.state),
    )
    .slice(0, limit);

  if (accepted.length === 0) {
    console.log("No accepted leads yet. Accept leads first, then re-run.");
    process.exit(0);
  }

  const system = loadPrompt("email/initial.md");
  const rows: WritingEvalRow[] = [];

  for (const lead of accepted) {
    const company = db
      .select()
      .from(companies)
      .where(eq(companies.id, lead.companyId))
      .get();
    if (!company) continue;

    const contact = db
      .select()
      .from(contacts)
      .where(eq(contacts.companyId, company.id))
      .all()[0];
    if (!contact?.email) {
      console.warn(`Skip ${lead.id}: no contact email`);
      continue;
    }

    const brief = db
      .select()
      .from(researchBriefs)
      .where(eq(researchBriefs.companyId, company.id))
      .all()
      .at(-1);

    const existing = db
      .select()
      .from(drafts)
      .where(eq(drafts.leadId, lead.id))
      .all()
      .find((d) => d.kind === "initial");

    const user = [
      `Company: ${company.name}`,
      `Domain: ${company.domain ?? ""}`,
      `Contact: ${contact.name ?? ""} <${contact.email}>`,
      `Role: ${contact.role ?? lead.recommendedContactRole ?? ""}`,
      `Angle: ${lead.recommendedAngle ?? ""}`,
      `Research JSON:\n${brief?.resultJson ?? "{}"}`,
      `Prompt version: ${EMAIL_PROMPT_VERSION}`,
      "Return JSON: { subject, body }",
    ].join("\n");

    for (const model of WRITING_COMPARE_MODELS) {
      if (dryRun) {
        rows.push({
          leadId: lead.id,
          companyName: company.name,
          domain: company.domain,
          model,
          subject: "(dry-run)",
          body: "(dry-run)",
          qualityOk: true,
          qualityCodes: [],
          notes: "dry-run — no API call",
        });
        continue;
      }

      const drafted = await draftWithModel({ model, system, user });
      const quality = checkDraftQuality({
        subject: drafted.subject,
        body: drafted.body,
        kind: "initial",
        contactConfidence: (contact.confidence ??
          "manual_confirmed") as "manual_confirmed",
        companyName: company.name,
      });

      const editPct = existing
        ? editRatio(drafted.body, existing.bodyFinal) * 100
        : undefined;

      rows.push({
        leadId: lead.id,
        companyName: company.name,
        domain: company.domain,
        model,
        subject: drafted.subject,
        body: drafted.body,
        qualityOk: quality.ok,
        qualityCodes: quality.issues.map((i) => i.code),
        editPercentage: editPct,
      });
    }
  }

  const outDir = path.join(process.cwd(), "data", "evals");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `writing-compare-${stamp}.json`);
  const payload = {
    createdAt: new Date().toISOString(),
    promptVersion: EMAIL_PROMPT_VERSION,
    models: [...WRITING_COMPARE_MODELS],
    instructions:
      "Score each row 1–5 for humanSounding, specificity, pushiness (lower better), clarity. Record minutesToFinal after you pick a final draft.",
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  console.log(`Wrote ${rows.length} rows → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
