import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  activities,
  companies,
  contacts,
  draftEdits,
  drafts,
  leads,
  researchBriefs,
  settings,
} from "@/db/schema";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages } from "@/lib/ai/google";
import {
  EMAIL_FOLLOWUP_PROMPT_VERSION,
  EMAIL_PROMPT_VERSION,
  loadPrompt,
} from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { canGenerateDraft, effectivePolicy, resolveCountryPolicy } from "@/lib/policy/country";
import { invalidateApprovalsForDraft } from "@/modules/mail/approvals";
import { editRatio } from "@/modules/learning/diff";
import type { ContactConfidence } from "@/modules/leads/actions";
import type { EvidenceItem, ResearchAndScore } from "@/modules/research/schemas";
import { critiqueDraft } from "./critique";
import { checkDraftQuality, type QualityIssue } from "./quality";

const DraftOutputSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type DraftKind = "initial" | "follow_up_1" | "follow_up_2";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

async function callWriter(input: {
  system: string;
  user: string;
  rewriteHint?: string;
}): Promise<{ subject: string; body: string; model: string }> {
  const model = resolveModel("draftMessage");
  const user = input.rewriteHint
    ? `${input.user}\n\n## Rewrite required\nFix these quality issues:\n${input.rewriteHint}\nReturn JSON only.`
    : input.user;

  const completion = await anthropicProvider.complete({
    model,
    messages: buildMessages(input.system, user),
    task: "draftMessage",
    temperature: 0.4,
  });

  const parsed = DraftOutputSchema.parse(parseJsonLoose(completion.text));
  return { subject: parsed.subject, body: parsed.body, model };
}

export async function generateDraft(
  leadId: string,
  contactId: string,
  options?: {
    kind?: DraftKind;
    requestCritique?: boolean;
    highValue?: boolean;
  },
): Promise<{
  draftId: string;
  quality: { ok: boolean; issues: QualityIssue[] };
  critique?: Awaited<ReturnType<typeof critiqueDraft>>;
}> {
  const kind: DraftKind = options?.kind ?? "initial";
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");

  const allowedStates =
    kind === "initial"
      ? ["accepted", "draft_ready"]
      : ["sent", "follow_up_due", "draft_ready", "accepted"];
  if (!allowedStates.includes(lead.state)) {
    throw new Error(
      kind === "initial"
        ? "Drafts are only generated after acceptance"
        : "Follow-up drafts require a sent or follow-up-due lead",
    );
  }
  if (
    lead.researchStatus !== "complete" &&
    lead.researchStatus !== "incomplete"
  ) {
    throw new Error("Enough research is required before drafting");
  }
  if (!lead.recommendedAngle || lead.recommendedAngle === "insufficient_evidence") {
    throw new Error("A usable outreach angle is required before drafting");
  }

  const contact = (await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1))[0];
  if (!contact) throw new Error("Contact not found");
  if (!contact.email) throw new Error("Contact needs an email before drafting");

  const company = (await db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId)).limit(1))[0];
  if (!company) throw new Error("Company not found");

  const jurisdiction = await canGenerateDraft(company.country);
  if (!jurisdiction.allowed) {
    throw new Error(jurisdiction.reason ?? "Jurisdiction policy blocks draft");
  }

  const brief = (await db
    .select()
    .from(researchBriefs)
    .where(eq(researchBriefs.companyId, lead.companyId))
    .orderBy(desc(researchBriefs.createdAt)).limit(1))[0];
  if (!brief) throw new Error("Research brief required before drafting");

  const research = JSON.parse(brief.resultJson) as ResearchAndScore;
  const evidence = JSON.parse(brief.evidenceJson) as EvidenceItem[];
  const setting = (await db.select().from(settings).limit(1))[0];

  const previous =
    kind !== "initial"
      ? (await db
          .select()
          .from(drafts)
          .where(eq(drafts.leadId, leadId))
          .orderBy(desc(drafts.createdAt)))
          .find((d) => d.kind === "initial" || d.state === "sent")
      : null;

  const promptFile =
    kind === "initial" ? "email/initial.md" : "email/follow-up.md";
  const promptVersion =
    kind === "initial" ? EMAIL_PROMPT_VERSION : EMAIL_FOLLOWUP_PROMPT_VERSION;
  const system = loadPrompt(promptFile);

  const payload = {
    company: {
      name: company.name,
      domain: company.domain,
      country: company.country,
    },
    contact: {
      name: contact.name,
      role: contact.role,
      email: contact.email,
      confidence: contact.confidence,
    },
    research,
    evidence,
    profile: setting
      ? {
          positioning: setting.profileMd,
          styleProfile: JSON.parse(setting.styleProfileJson || "{}"),
        }
      : {
          positioning:
            "Senior product designer. Fractional design leadership, design systems, product redesign.",
        },
    messageKind: kind,
    previousThread: previous
      ? `Subject: ${previous.subject}\n\n${previous.bodyFinal}`
      : undefined,
    language: "en",
  };

  const user = JSON.stringify(payload, null, 2);
  let written = await callWriter({ system, user });

  const policy = await resolveCountryPolicy(company.country);
  const requireOptOut =
    effectivePolicy(policy.policy) === "manual_review_required";

  const qualityInput = {
    subject: written.subject,
    body: written.body,
    kind,
    contactConfidence: contact.confidence as ContactConfidence,
    contactEmail: contact.email,
    evidenceExcerpts: evidence.map((e) => e.excerpt),
    companyName: company.name,
    requireOptOut,
  };

  let quality = checkDraftQuality(qualityInput);

  // One deterministic rewrite if checks fail
  if (!quality.ok) {
    const hint = quality.issues.map((i) => `- ${i.message}`).join("\n");
    written = await callWriter({ system, user, rewriteHint: hint });
    quality = checkDraftQuality({
      ...qualityInput,
      subject: written.subject,
      body: written.body,
    });
  }

  let critique: Awaited<ReturnType<typeof critiqueDraft>> | undefined;
  const shouldCritique =
    options?.requestCritique ||
    options?.highValue ||
    (!quality.ok && (lead.score ?? 0) >= 7);

  if (shouldCritique) {
    critique = await critiqueDraft({
      subject: written.subject,
      body: written.body,
      contextJson: JSON.stringify({
        company: company.name,
        angle: lead.recommendedAngle,
        qualityIssues: quality.issues,
      }),
    });
    if (critique.revisedSubject && critique.revisedBody) {
      written = {
        subject: critique.revisedSubject,
        body: critique.revisedBody,
        model: written.model,
      };
      quality = checkDraftQuality({
        ...qualityInput,
        subject: written.subject,
        body: written.body,
      });
    }
  }

  const now = nowIso();
  const draftId = newId("draft");

  await db.insert(drafts)
    .values({
      id: draftId,
      leadId,
      contactId,
      kind,
      subject: written.subject,
      bodyGenerated: written.body,
      bodyFinal: written.body,
      model: written.model,
      promptVersion,
      state: "draft",
      createdAt: now,
      updatedAt: now,
    });

  if (kind === "initial") {
    await db.update(leads)
      .set({ state: "draft_ready", updatedAt: now })
      .where(eq(leads.id, leadId));
  }

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "draft_generated",
      metadataJson: JSON.stringify({
        draftId,
        kind,
        quality,
        critiqueScore: critique?.score ?? null,
      }),
      occurredAt: now,
    });

  logger.info({ leadId, draftId, kind, qualityOk: quality.ok }, "Draft generated");
  return { draftId, quality, critique };
}

export async function updateDraft(draftId: string, bodyFinal: string, subject?: string) {
  const db = getDb();
  const draft = (await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1))[0];
  if (!draft) throw new Error("Draft not found");

  const nextSubject = subject ?? draft.subject;
  const changed =
    nextSubject !== draft.subject || bodyFinal !== draft.bodyFinal;

  await db.update(drafts)
    .set({
      bodyFinal,
      subject: nextSubject,
      state: draft.state === "approved" && changed ? "draft" : draft.state,
      updatedAt: nowIso(),
    })
    .where(eq(drafts.id, draftId));

  if (changed) {
    const ratio = editRatio(
      `${draft.subject}\n${draft.bodyFinal}`,
      `${nextSubject}\n${bodyFinal}`,
    );
    await db.insert(draftEdits)
      .values({
        id: newId("ded"),
        draftId,
        leadId: draft.leadId,
        subjectBefore: draft.subject,
        subjectAfter: nextSubject,
        bodyBefore: draft.bodyFinal,
        bodyAfter: bodyFinal,
        editRatio: ratio,
        createdAt: nowIso(),
      });
    await invalidateApprovalsForDraft(draftId);
  }
}

export async function markDraftSent(draftId: string) {
  const db = getDb();
  const draft = (await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1))[0];
  if (!draft) throw new Error("Draft not found");

  if (draft.contactId) {
    const contact = (await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, draft.contactId)).limit(1))[0];
    if (
      contact?.confidence === "pattern_unverified" ||
      contact?.confidence === "unknown"
    ) {
      throw new Error(
        `Cannot mark sent: contact confidence is ${contact.confidence}`,
      );
    }
  }

  const now = nowIso();
  await db.update(drafts)
    .set({ state: "sent", updatedAt: now })
    .where(eq(drafts.id, draftId));

  await db.update(leads)
    .set({ state: "sent", updatedAt: now })
    .where(eq(leads.id, draft.leadId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId: draft.leadId,
      type: "marked_sent",
      metadataJson: JSON.stringify({ draftId }),
      occurredAt: now,
    });
}

/** Run quality checks on current draft body without regenerating. */
export async function inspectDraftQuality(draftId: string) {
  const db = getDb();
  const draft = (await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1))[0];
  if (!draft) throw new Error("Draft not found");

  const lead = (await db.select().from(leads).where(eq(leads.id, draft.leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");

  const company = (await db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId)).limit(1))[0];

  const contact = draft.contactId
    ? (await db.select().from(contacts).where(eq(contacts.id, draft.contactId)).limit(1))[0]
    : null;

  const brief = (await db
    .select()
    .from(researchBriefs)
    .where(eq(researchBriefs.companyId, lead.companyId))
    .orderBy(desc(researchBriefs.createdAt)).limit(1))[0];

  const evidence = brief
    ? (JSON.parse(brief.evidenceJson) as EvidenceItem[])
    : [];

  const policy = await resolveCountryPolicy(company?.country);
  const requireOptOut =
    effectivePolicy(policy.policy) === "manual_review_required";

  return checkDraftQuality({
    subject: draft.subject,
    body: draft.bodyFinal,
    kind: (draft.kind as DraftKind) || "initial",
    contactConfidence: (contact?.confidence as ContactConfidence) ?? "unknown",
    contactEmail: contact?.email,
    evidenceExcerpts: evidence.map((e) => e.excerpt),
    companyName: company?.name,
    requireOptOut,
  });
}
