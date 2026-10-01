"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import {
  generateDraft,
  inspectDraftQuality,
  markDraftSent,
  updateDraft,
  type DraftKind,
} from "./drafts";

/** Outreach drafts for client leads (owner only). Sending goes through mail approvals. */

type QualitySummary = {
  ok: boolean;
  issues: Array<{ code: string; message: string }>;
};

/** Only what the lead screen renders; keeps internal check details server-side. */
function summarizeQuality(quality: {
  ok: boolean;
  issues: Array<{ code: string; message: string }>;
}): QualitySummary {
  return {
    ok: quality.ok,
    issues: quality.issues.map((i) => ({ code: i.code, message: i.message })),
  };
}

export async function generateDraftAction(
  leadId: string,
  contactId: string,
  options?: { kind?: DraftKind; requestCritique?: boolean },
) {
  return runAction("outreach.generateDraft", "owner", async () => {
    const result = await generateDraft(leadId, contactId, {
      kind: options?.kind,
      requestCritique: options?.requestCritique,
    });
    revalidatePath(`/leads/${leadId}`);
    return { draftId: result.draftId, quality: summarizeQuality(result.quality) };
  });
}

export async function inspectDraftQualityAction(leadId: string, draftId: string) {
  return runAction("outreach.inspectQuality", "owner", async () => {
    const quality = await inspectDraftQuality(draftId);
    revalidatePath(`/leads/${leadId}`);
    return summarizeQuality(quality);
  });
}

export async function saveDraftAction(
  leadId: string,
  draftId: string,
  bodyFinal: string,
  subject: string,
) {
  return runAction("outreach.saveDraft", "owner", async () => {
    await updateDraft(draftId, bodyFinal, subject);
    revalidatePath(`/leads/${leadId}`);
  });
}

/** Records a draft the owner sent by hand (outside the send queue). */
export async function markSentAction(leadId: string, draftId: string) {
  return runAction("outreach.markSent", "owner", async () => {
    await markDraftSent(draftId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
  });
}
