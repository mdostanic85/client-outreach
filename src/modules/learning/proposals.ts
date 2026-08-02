import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  draftEdits,
  learningProposals,
  learningReports,
  settings,
  settingsScoring,
} from "@/db/schema";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages } from "@/lib/ai/google";
import { resolveModel } from "@/lib/ai/routing";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { assertGatesOrPreview } from "./gates";
import { buildSourcePerformance } from "./reports";
import { approveSearchProfile } from "@/modules/search-profile/approve";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

const StyleProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  stylePatch: z.object({
    voiceNotes: z.string().optional(),
    doListAdd: z.array(z.string()).optional(),
    dontListAdd: z.array(z.string()).optional(),
    preferredLength: z.string().optional(),
    ctaPatternsAdd: z.array(z.string()).optional(),
  }),
});

export async function proposeStyleUpdate(force = false) {
  assertGatesOrPreview(force);
  const db = getDb();
  const edits = (await db
    .select()
    .from(draftEdits))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25);

  if (edits.length === 0) {
    throw new Error("No draft edits to learn from");
  }

  const setting = (await db.select().from(settings).limit(1))[0];
  const model = resolveModel("styleProposal");
  const system =
    "You propose style-profile updates from draft edit diffs. " +
    "Return JSON only matching {title, summary, stylePatch}. " +
    "Never invent client facts. Proposals are suggestions only.";
  const user = JSON.stringify(
    {
      currentStyle: JSON.parse(setting?.styleProfileJson || "{}"),
      edits: edits.map((e) => ({
        editRatio: e.editRatio,
        subjectBefore: e.subjectBefore,
        subjectAfter: e.subjectAfter,
        bodyBefore: e.bodyBefore.slice(0, 800),
        bodyAfter: e.bodyAfter.slice(0, 800),
      })),
    },
    null,
    2,
  );

  const completion = await anthropicProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "styleProposal",
    temperature: 0.3,
  });

  const parsed = StyleProposalSchema.parse(parseJsonLoose(completion.text));
  const id = newId("prop");
  const now = nowIso();
  await db.insert(learningProposals)
    .values({
      id,
      kind: "style_update",
      title: parsed.title,
      summary: parsed.summary,
      proposalJson: JSON.stringify(parsed.stylePatch),
      status: "pending",
      model,
      createdAt: now,
      decidedAt: null,
    });

  logger.info({ id }, "Style proposal created (pending approval)");
  return id;
}

export async function proposeScoringWeights(force = false) {
  assertGatesOrPreview(force);
  const db = getDb();
  // Deterministic heuristic proposal from accept/reject patterns — no auto-apply
  const { rows } = await buildSourcePerformance();
  const top = rows.filter((r) => r.leads >= 3).slice(0, 5);
  const weights = {
    needNow: 0.3,
    fit: 0.25,
    abilityToPay: 0.15,
    accessibility: 0.15,
    engagementMatch: 0.15,
    sourceBoosts: Object.fromEntries(
      top.map((r) => [r.source, Number((r.acceptRate * 0.1).toFixed(3))]),
    ),
    rationale: top.map(
      (r) =>
        `${r.source}: accept ${(r.acceptRate * 100).toFixed(0)}% · reply ${(r.replyRate * 100).toFixed(0)}%`,
    ),
  };

  const id = newId("prop");
  const now = nowIso();
  await db.insert(learningProposals)
    .values({
      id,
      kind: "scoring_weights",
      title: "Scoring weight proposal from source outcomes",
      summary:
        "Suggested soft source boosts from accept/reply rates. Not applied until approved.",
      proposalJson: JSON.stringify(weights),
      status: "pending",
      model: null,
      createdAt: now,
      decidedAt: null,
    });
  return id;
}

export async function generateMarketReport(force = false) {
  assertGatesOrPreview(force);
  const db = getDb();
  const { rows } = await buildSourcePerformance();
  const setting = (await db.select().from(settings).limit(1))[0];
  const model = resolveModel("marketReport");

  const system =
    "Write a weekly market-demand report in Markdown for a senior product designer. " +
    "Base only on provided outcome stats. Be honest about small samples. " +
    "Return JSON {title, bodyMd}.";
  const user = JSON.stringify(
    {
      profile: setting?.profileMd?.slice(0, 1500),
      sourcePerformance: rows,
      note: "Do not invent companies or demand that is not implied by the stats.",
    },
    null,
    2,
  );

  const completion = await anthropicProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "marketReport",
    temperature: 0.4,
  });

  const parsed = z
    .object({ title: z.string(), bodyMd: z.string() })
    .parse(parseJsonLoose(completion.text));

  const id = newId("rep");
  await db.insert(learningReports)
    .values({
      id,
      kind: "market_demand",
      title: parsed.title,
      bodyMd: parsed.bodyMd,
      dataJson: JSON.stringify({ rows }),
      model,
      createdAt: nowIso(),
    });
  return id;
}

export async function generatePositioningRecs(force = false) {
  assertGatesOrPreview(force);
  const db = getDb();
  const setting = (await db.select().from(settings).limit(1))[0];
  const edits = (await db.select().from(draftEdits)).slice(0, 15);
  const { rows } = await buildSourcePerformance();
  const model = resolveModel("positioningRecs");

  const system =
    "Recommend portfolio / CV / LinkedIn / service-positioning updates. " +
    "Return JSON {title, bodyMd, recommendations: string[]}. Suggestions only.";
  const user = JSON.stringify(
    {
      profile: setting?.profileMd,
      style: JSON.parse(setting?.styleProfileJson || "{}"),
      sourcePerformance: rows.slice(0, 8),
      recentEditRatios: edits.map((e) => e.editRatio),
    },
    null,
    2,
  );

  const completion = await anthropicProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "positioningRecs",
    temperature: 0.4,
  });

  const parsed = z
    .object({
      title: z.string(),
      bodyMd: z.string(),
      recommendations: z.array(z.string()).optional(),
    })
    .parse(parseJsonLoose(completion.text));

  const id = newId("rep");
  await db.insert(learningReports)
    .values({
      id,
      kind: "positioning",
      title: parsed.title,
      bodyMd: parsed.bodyMd,
      dataJson: JSON.stringify({
        recommendations: parsed.recommendations ?? [],
      }),
      model,
      createdAt: nowIso(),
    });
  return id;
}

export async function applyProposal(proposalId: string) {
  const db = getDb();
  const proposal = (await db
    .select()
    .from(learningProposals)
    .where(eq(learningProposals.id, proposalId)).limit(1))[0];
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "pending") {
    throw new Error(`Proposal status is ${proposal.status}`);
  }

  const now = nowIso();
  if (proposal.kind === "style_update") {
    const patch = JSON.parse(proposal.proposalJson) as {
      voiceNotes?: string;
      doListAdd?: string[];
      dontListAdd?: string[];
      preferredLength?: string;
      ctaPatternsAdd?: string[];
    };
    const setting = (await db.select().from(settings).limit(1))[0];
    if (!setting) throw new Error("Settings missing");
    const style = JSON.parse(setting.styleProfileJson || "{}") as Record<
      string,
      unknown
    >;
    if (patch.voiceNotes) style.voiceNotes = patch.voiceNotes;
    if (patch.preferredLength) style.preferredLength = patch.preferredLength;
    if (patch.doListAdd?.length) {
      style.doList = [
        ...((style.doList as string[]) ?? []),
        ...patch.doListAdd,
      ];
    }
    if (patch.dontListAdd?.length) {
      style.dontList = [
        ...((style.dontList as string[]) ?? []),
        ...patch.dontListAdd,
      ];
    }
    if (patch.ctaPatternsAdd?.length) {
      style.ctaPatterns = [
        ...((style.ctaPatterns as string[]) ?? []),
        ...patch.ctaPatternsAdd,
      ];
    }
    await db.update(settings)
      .set({ styleProfileJson: JSON.stringify(style), updatedAt: now })
      .where(eq(settings.id, setting.id));
  } else if (proposal.kind === "scoring_weights") {
    const existing = (await db.select().from(settingsScoring).limit(1))[0];
    if (existing) {
      await db.update(settingsScoring)
        .set({ weightsJson: proposal.proposalJson, updatedAt: now })
        .where(eq(settingsScoring.id, existing.id));
    } else {
      await db.insert(settingsScoring)
        .values({
          id: newId("scw"),
          weightsJson: proposal.proposalJson,
          updatedAt: now,
        });
    }
  } else if (proposal.kind === "search_strategy") {
    const payload = JSON.parse(proposal.proposalJson) as {
      draftSearchProfileId?: string;
    };
    if (!payload.draftSearchProfileId) {
      throw new Error("search_strategy proposal missing draftSearchProfileId");
    }
    await approveSearchProfile(payload.draftSearchProfileId);
  } else {
    throw new Error(`Unknown proposal kind: ${proposal.kind}`);
  }

  await db.update(learningProposals)
    .set({ status: "applied", decidedAt: now })
    .where(eq(learningProposals.id, proposalId));
}

export async function rejectProposal(proposalId: string) {
  const db = getDb();
  const proposal = (await db
    .select()
    .from(learningProposals)
    .where(eq(learningProposals.id, proposalId)).limit(1))[0];
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "pending") {
    throw new Error(`Proposal status is ${proposal.status}`);
  }
  await db.update(learningProposals)
    .set({ status: "rejected", decidedAt: nowIso() })
    .where(eq(learningProposals.id, proposalId));
}

export async function saveSourcePerformanceReport() {
  const { rows, generatedAt } = await buildSourcePerformance();
  const id = newId("rep");
  const lines = [
    `# Source performance`,
    ``,
    `Generated ${generatedAt}`,
    ``,
    `| Source | Signals | Leads | Accept | Sent | Reply | Accept% | Reply% |`,
    `|---|---:|---:|---:|---:|---:|---:|---:|`,
    ...rows.map(
      (r) =>
        `| ${r.source} | ${r.signals} | ${r.leads} | ${r.accepted} | ${r.sent} | ${r.replied} | ${(r.acceptRate * 100).toFixed(0)}% | ${(r.replyRate * 100).toFixed(0)}% |`,
    ),
  ];
  await getDb()
    .insert(learningReports)
    .values({
      id,
      kind: "source_performance",
      title: "Source performance report",
      bodyMd: lines.join("\n"),
      dataJson: JSON.stringify({ rows }),
      model: null,
      createdAt: generatedAt,
    });
  return id;
}
