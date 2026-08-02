"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import {
  discoverAndPersistOne,
  submitManualCompany,
} from "@/modules/discovery/persist";
import {
  acceptLead,
  addManualContact,
  confirmContact,
  markLeadReplied,
  rejectLead,
  saveLeadForLater,
  setFollowUpDate,
  setLeadState,
  suppressLead,
  type ContactConfidence,
} from "@/modules/leads/actions";
import {
  generateDraft,
  inspectDraftQuality,
  markDraftSent,
  updateDraft,
  type DraftKind,
} from "@/modules/outreach/drafts";
import { researchCompany } from "@/modules/research/run";
import { runWorkerPipeline } from "@/modules/tracking/worker";
import { nowIso } from "@/lib/ids";
import type { LeadState } from "@/modules/leads/states";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(err: unknown): ActionResult<never> {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

export async function runVerticalSliceAction(): Promise<
  ActionResult<{ leadId: string; companyId: string }>
> {
  try {
    ensureDb();
    const persisted = await discoverAndPersistOne({ preferDomain: true });
    if (!persisted) {
      return { ok: false, error: "No Remotive signals available" };
    }
    await researchCompany(persisted.companyId);
    revalidatePath("/");
    revalidatePath(`/leads/${persisted.leadId}`);
    return {
      ok: true,
      data: { leadId: persisted.leadId, companyId: persisted.companyId },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function submitManualCompanyAction(input: {
  companyName: string;
  companyUrl: string;
  title?: string;
  location?: string;
  researchNow?: boolean;
}): Promise<ActionResult<{ leadId: string; companyId: string }>> {
  try {
    ensureDb();
    const persisted = await submitManualCompany(input);
    if (input.researchNow !== false) {
      await researchCompany(persisted.companyId);
    }
    revalidatePath("/");
    revalidatePath(`/leads/${persisted.leadId}`);
    return {
      ok: true,
      data: { leadId: persisted.leadId, companyId: persisted.companyId },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function runDailyPipelineAction(): Promise<
  ActionResult<{ runId: string }>
> {
  try {
    ensureDb();
    const result = await runWorkerPipeline();
    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true, data: { runId: result.runId } };
  } catch (err) {
    return fail(err);
  }
}

export async function researchLeadAction(
  companyId: string,
  leadId: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    await researchCompany(companyId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function acceptLeadAction(leadId: string): Promise<ActionResult> {
  try {
    ensureDb();
    acceptLead(leadId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function rejectLeadAction(
  leadId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    rejectLead(leadId, reason);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function saveForLaterAction(leadId: string): Promise<ActionResult> {
  try {
    ensureDb();
    saveLeadForLater(leadId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function markRepliedAction(leadId: string): Promise<ActionResult> {
  try {
    ensureDb();
    markLeadReplied(leadId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function setFollowUpAction(
  leadId: string,
  followUpAt: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    setFollowUpDate(leadId, followUpAt);
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function suppressLeadAction(
  leadId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    suppressLead(leadId, reason);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function setLeadStateAction(
  leadId: string,
  state: LeadState,
): Promise<ActionResult> {
  try {
    ensureDb();
    setLeadState(leadId, state);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function addContactAction(input: {
  companyId: string;
  leadId: string;
  name: string;
  email: string;
  role?: string;
  confidence: ContactConfidence;
}): Promise<ActionResult<{ contactId: string }>> {
  try {
    ensureDb();
    const contactId = addManualContact(input);
    revalidatePath(`/leads/${input.leadId}`);
    return { ok: true, data: { contactId } };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmContactAction(
  contactId: string,
  leadId: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    confirmContact(contactId, leadId);
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function harvestContactsAction(
  leadId: string,
): Promise<
  ActionResult<{
    contactsCreated: number;
    emailsFound: number;
    people?: Array<{ name: string; role: string | null }>;
  }>
> {
  try {
    ensureDb();
    const { harvestContactsForLead } = await import(
      "@/modules/contacts/harvest"
    );
    const { extractPeopleFromTeamText } = await import(
      "@/modules/contacts/extract-people"
    );
    const { getDb } = await import("@/db/client");
    const { leads } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const harvest = await harvestContactsForLead(leadId);
    let people: Array<{ name: string; role: string | null }> = [];

    if (harvest.teamPageText && harvest.teamPageUrl) {
      const lead = getDb().select().from(leads).where(eq(leads.id, leadId)).get();
      people = await extractPeopleFromTeamText({
        leadId,
        pageUrl: harvest.teamPageUrl,
        pageText: harvest.teamPageText,
        recommendedRole: lead?.recommendedContactRole,
      });
    }

    revalidatePath(`/leads/${leadId}`);
    return {
      ok: true,
      data: {
        contactsCreated: harvest.contactsCreated,
        emailsFound: harvest.emails.length,
        people: people.slice(0, 10),
      },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function suggestPatternsAction(input: {
  leadId: string;
  companyId: string;
  fullName: string;
  domain: string;
  role?: string;
}): Promise<ActionResult<{ suggestions: Array<{ email: string; pattern: string }> }>> {
  try {
    ensureDb();
    const { suggestEmailPatterns } = await import(
      "@/modules/contacts/patterns"
    );
    const suggestions = suggestEmailPatterns({
      fullName: input.fullName,
      domain: input.domain,
    });
    return { ok: true, data: { suggestions } };
  } catch (err) {
    return fail(err);
  }
}

export async function checkMxAction(
  domain: string,
): Promise<ActionResult<{ ok: boolean; hosts: string[]; error?: string }>> {
  try {
    const { checkDomainMx } = await import("@/modules/contacts/mx");
    const result = await checkDomainMx(domain);
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function generateDraftAction(
  leadId: string,
  contactId: string,
  options?: {
    kind?: DraftKind;
    requestCritique?: boolean;
  },
): Promise<
  ActionResult<{
    draftId: string;
    quality: { ok: boolean; issues: Array<{ code: string; message: string }> };
  }>
> {
  try {
    ensureDb();
    const result = await generateDraft(leadId, contactId, options);
    revalidatePath(`/leads/${leadId}`);
    return {
      ok: true,
      data: {
        draftId: result.draftId,
        quality: {
          ok: result.quality.ok,
          issues: result.quality.issues.map((i) => ({
            code: i.code,
            message: i.message,
          })),
        },
      },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function inspectDraftQualityAction(
  leadId: string,
  draftId: string,
): Promise<
  ActionResult<{ ok: boolean; issues: Array<{ code: string; message: string }> }>
> {
  try {
    ensureDb();
    const quality = inspectDraftQuality(draftId);
    revalidatePath(`/leads/${leadId}`);
    return {
      ok: true,
      data: {
        ok: quality.ok,
        issues: quality.issues.map((i) => ({
          code: i.code,
          message: i.message,
        })),
      },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function saveDraftAction(
  leadId: string,
  draftId: string,
  bodyFinal: string,
  subject: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    updateDraft(draftId, bodyFinal, subject);
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function markSentAction(
  leadId: string,
  draftId: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    markDraftSent(draftId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function approveDraftAction(
  leadId: string,
  draftId: string,
): Promise<ActionResult<{ approvalId: string }>> {
  try {
    ensureDb();
    const { approveDraft } = await import("@/modules/mail/approvals");
    const approvalId = approveDraft(draftId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/queue");
    return { ok: true, data: { approvalId } };
  } catch (err) {
    return fail(err);
  }
}

export async function processSendQueueAction(): Promise<
  ActionResult<{ sent: number; processed: number; skipped: Array<{ id: string; reason: string }> }>
> {
  try {
    ensureDb();
    const { processSendQueue } = await import("@/modules/mail/send");
    const result = await processSendQueue();
    revalidatePath("/queue");
    revalidatePath("/");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function syncMailboxAction(): Promise<
  ActionResult<{ fetched: number; stored: number }>
> {
  try {
    ensureDb();
    const { syncInbox } = await import("@/modules/mail/sync");
    const result = await syncInbox();
    revalidatePath("/queue");
    revalidatePath("/");
    return {
      ok: true,
      data: { fetched: result.fetched, stored: result.stored },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function resumeMailboxAction(): Promise<ActionResult> {
  try {
    ensureDb();
    const { resumeMailbox } = await import("@/modules/mail/approvals");
    resumeMailbox();
    revalidatePath("/queue");
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function saveSourceReportAction(): Promise<
  ActionResult<{ reportId: string }>
> {
  try {
    ensureDb();
    const { saveSourcePerformanceReport } = await import(
      "@/modules/learning/proposals"
    );
    const reportId = saveSourcePerformanceReport();
    revalidatePath("/learning");
    revalidatePath("/analytics");
    return { ok: true, data: { reportId } };
  } catch (err) {
    return fail(err);
  }
}

export async function proposeStyleAction(
  force = false,
): Promise<ActionResult<{ proposalId: string }>> {
  try {
    ensureDb();
    const { proposeStyleUpdate } = await import("@/modules/learning/proposals");
    const proposalId = await proposeStyleUpdate(force);
    revalidatePath("/learning");
    return { ok: true, data: { proposalId } };
  } catch (err) {
    return fail(err);
  }
}

export async function proposeScoringAction(
  force = false,
): Promise<ActionResult<{ proposalId: string }>> {
  try {
    ensureDb();
    const { proposeScoringWeights } = await import(
      "@/modules/learning/proposals"
    );
    const proposalId = proposeScoringWeights(force);
    revalidatePath("/learning");
    return { ok: true, data: { proposalId } };
  } catch (err) {
    return fail(err);
  }
}

export async function generateMarketReportAction(
  force = false,
): Promise<ActionResult<{ reportId: string }>> {
  try {
    ensureDb();
    const { generateMarketReport } = await import(
      "@/modules/learning/proposals"
    );
    const reportId = await generateMarketReport(force);
    revalidatePath("/learning");
    return { ok: true, data: { reportId } };
  } catch (err) {
    return fail(err);
  }
}

export async function generatePositioningAction(
  force = false,
): Promise<ActionResult<{ reportId: string }>> {
  try {
    ensureDb();
    const { generatePositioningRecs } = await import(
      "@/modules/learning/proposals"
    );
    const reportId = await generatePositioningRecs(force);
    revalidatePath("/learning");
    return { ok: true, data: { reportId } };
  } catch (err) {
    return fail(err);
  }
}

export async function applyLearningProposalAction(
  proposalId: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { applyProposal } = await import("@/modules/learning/proposals");
    applyProposal(proposalId);
    revalidatePath("/learning");
    revalidatePath("/settings");
    revalidatePath("/search-criteria");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function rejectLearningProposalAction(
  proposalId: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { rejectProposal } = await import("@/modules/learning/proposals");
    rejectProposal(proposalId);
    revalidatePath("/learning");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function updateSettingsAction(input: {
  profileMd?: string;
  styleProfileJson?: string;
  targetFiltersJson?: string;
  countryPolicyJson?: string;
  sendPolicyJson?: string;
  dailyLeadCount?: number;
  aiBudgetUsd?: number;
}): Promise<ActionResult> {
  try {
    ensureDb();
    const db = getDb();
    const row = db.select().from(settings).all()[0];
    if (!row) throw new Error("Settings not found");

    db.update(settings)
      .set({
        profileMd: input.profileMd ?? row.profileMd,
        styleProfileJson: input.styleProfileJson ?? row.styleProfileJson,
        targetFiltersJson: input.targetFiltersJson ?? row.targetFiltersJson,
        countryPolicyJson: input.countryPolicyJson ?? row.countryPolicyJson,
        sendPolicyJson: input.sendPolicyJson ?? row.sendPolicyJson,
        dailyLeadCount: input.dailyLeadCount ?? row.dailyLeadCount,
        aiBudgetUsd: input.aiBudgetUsd ?? row.aiBudgetUsd,
        updatedAt: nowIso(),
      })
      .where(eq(settings.id, row.id))
      .run();

    revalidatePath("/settings");
    revalidatePath("/admin");
    revalidatePath("/queue");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

/** Export/delete always available — must not be blocked by AI budget. */
export async function exportPersonalDataAction(input?: {
  leadId?: string;
  companyId?: string;
}): Promise<ActionResult<{ path: string; bytes: number }>> {
  try {
    ensureDb();
    const { writePersonalDataExport } = await import(
      "@/modules/privacy/export"
    );
    const result = writePersonalDataExport({
      leadId: input?.leadId,
      companyId: input?.companyId,
    });
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteContactAction(
  contactId: string,
  force = false,
): Promise<ActionResult<{ deleted: boolean; reason?: string }>> {
  try {
    ensureDb();
    const { deleteContactData } = await import("@/modules/privacy/delete");
    const result = deleteContactData(contactId, { force });
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function runRetentionPruneAction(
  dryRun = true,
): Promise<
  ActionResult<{
    dryRun: boolean;
    rejectedLeadContactsDeleted: string[];
    neverContactedDeleted: string[];
    rawSignalsCleared: string[];
  }>
> {
  try {
    ensureDb();
    const { runRetentionPrune } = await import("@/modules/privacy/retention");
    const result = runRetentionPrune({ dryRun });
    revalidatePath("/admin");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function saveSecretAction(
  name: string,
  value: string,
): Promise<ActionResult<{ source: "keychain" | "env" }>> {
  try {
    const { setSecret } = await import("@/lib/security/secrets");
    const source = setSecret(name, value);
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/queue");
    return { ok: true, data: { source } };
  } catch (err) {
    return fail(err);
  }
}

export async function clearSecretAction(
  name: string,
): Promise<ActionResult> {
  try {
    const { clearSecret } = await import("@/lib/security/secrets");
    clearSecret(name);
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/queue");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function updateOpsChecklistAction(input: {
  productValidated?: boolean;
  dedicatedMailbox?: boolean;
  spfConfirmed?: boolean;
  dkimConfirmed?: boolean;
  dmarcReviewed?: boolean;
  manualLowVolumePracticed?: boolean;
  notes?: string;
}): Promise<ActionResult> {
  try {
    ensureDb();
    const db = getDb();
    const row = db.select().from(settings).all()[0];
    if (!row) throw new Error("Settings not found");
    const { parseOpsChecklist } = await import("@/modules/ops/readiness");
    const current = parseOpsChecklist(row.opsChecklistJson);
    const next = { ...current, ...input };
    db.update(settings)
      .set({
        opsChecklistJson: JSON.stringify(next),
        updatedAt: nowIso(),
      })
      .where(eq(settings.id, row.id))
      .run();
    revalidatePath("/admin");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function ingestCvAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; reused: boolean; textLength: number }>> {
  try {
    ensureDb();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file uploaded" };
    }
    const rawType = String(formData.get("type") ?? "cv");
    const {
      ingestFileUpload,
      isFileProfileSourceType,
    } = await import("@/modules/profile/ingest");
    if (!isFileProfileSourceType(rawType)) {
      return { ok: false, error: "Invalid source type" };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const defaultName =
      rawType === "linkedin_text" ? "linkedin-profile.pdf" : "cv.pdf";
    const result = await ingestFileUpload({
      filename: file.name || defaultName,
      bytes,
      type: rawType,
      label:
        rawType === "linkedin_text"
          ? file.name || "LinkedIn Save to PDF"
          : undefined,
    });
    revalidatePath("/profile");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function ingestTextSourceAction(input: {
  type: "cv" | "linkedin_text" | "document" | "manual";
  text: string;
  label?: string;
}): Promise<ActionResult<{ id: string; reused: boolean }>> {
  try {
    ensureDb();
    const { ingestTextSource } = await import("@/modules/profile/ingest");
    const result = await ingestTextSource(input);
    revalidatePath("/profile");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function ingestPortfolioUrlAction(
  url: string,
): Promise<ActionResult<{ id: string; reused: boolean; textLength: number }>> {
  try {
    ensureDb();
    const { ingestPortfolioUrl } = await import("@/modules/profile/ingest");
    const result = await ingestPortfolioUrl(url);
    revalidatePath("/profile");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function ingestGithubAction(
  usernameOrUrl: string,
): Promise<ActionResult<{ id: string; reused: boolean; textLength: number }>> {
  try {
    ensureDb();
    const { ingestGithubProfile } = await import("@/modules/profile/ingest");
    const result = await ingestGithubProfile(usernameOrUrl);
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function ingestManualNotesAction(
  text: string,
): Promise<ActionResult<{ id: string; reused: boolean }>> {
  try {
    ensureDb();
    const { ingestTextSource } = await import("@/modules/profile/ingest");
    const result = await ingestTextSource({
      type: "manual",
      text,
      label: "Manual preferences",
    });
    revalidatePath("/profile");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteProfileSourceAction(
  id: string,
  options?: { confirmed?: boolean },
): Promise<ActionResult> {
  try {
    ensureDb();
    if (!options?.confirmed) {
      return {
        ok: false,
        error: "Confirm delete to remove this source connection.",
      };
    }
    const { softDeleteProfileSource } = await import(
      "@/modules/profile/ingest"
    );
    softDeleteProfileSource(id);
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function setProfileSourceMatchingEnabledAction(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { setProfileSourceMatchingEnabled } = await import(
      "@/modules/profile/ingest"
    );
    setProfileSourceMatchingEnabled(id, enabled);
    revalidatePath("/profile");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function refreshProfileSourceAction(
  id: string,
): Promise<ActionResult<{ id: string; textLength: number }>> {
  try {
    ensureDb();
    const { refreshProfileSource } = await import("@/modules/profile/ingest");
    const result = await refreshProfileSource(id);
    revalidatePath("/profile");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function setMatchingSourcesConfigAction(
  patch: Partial<
    import("@/modules/profile/matching-sources").MatchingSourcesConfig
  >,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { setMatchingSourcesConfig } = await import(
      "@/modules/profile/matching-sources"
    );
    setMatchingSourcesConfig(patch);
    revalidatePath("/profile");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function extractProfileAction(): Promise<
  ActionResult<{
    profileId: string;
    version: number;
    model: string;
    usedPrivate: boolean;
    groundingIssues: string[];
  }>
> {
  try {
    ensureDb();
    const { extractStructuredProfile } = await import(
      "@/modules/profile/extract"
    );
    const result = await extractStructuredProfile();
    revalidatePath("/profile");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function saveProfileDraftAction(
  profileId: string,
  profile: import("@/modules/profile/schemas").StructuredProfile,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { saveDraftProfileEdits } = await import("@/modules/profile/extract");
    saveDraftProfileEdits(profileId, profile);
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function updateProfileFactAction(input: {
  profileId: string;
  field: string;
  value: string;
  index?: number;
  projectTitle?: string;
}): Promise<ActionResult<{ profileId: string }>> {
  try {
    ensureDb();
    const { updateFact } = await import("@/modules/profile/facts");
    const result = updateFact(input);
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function removeProfileFactAction(input: {
  profileId: string;
  field: string;
  index?: number;
  value?: string;
  projectTitle?: string;
}): Promise<ActionResult<{ profileId: string }>> {
  try {
    ensureDb();
    const { removeFact } = await import("@/modules/profile/facts");
    const result = removeFact(input);
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function addProfileFactAction(input: {
  profileId: string;
  field: string;
  value: string;
}): Promise<ActionResult<{ profileId: string }>> {
  try {
    ensureDb();
    const { addFact } = await import("@/modules/profile/facts");
    const result = addFact(input);
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function applyProfileDiffDecisionsAction(input: {
  draftId: string;
  decisions: Record<
    string,
    import("@/modules/profile/diff").DiffDecision
  >;
  edits?: Record<string, string>;
}): Promise<ActionResult<{ profileId: string }>> {
  try {
    ensureDb();
    const { applyDiffDecisionsToDraft } = await import(
      "@/modules/profile/facts"
    );
    const result = applyDiffDecisionsToDraft(input);
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function createProfileDraftFromApprovedAction(): Promise<
  ActionResult<{ profileId: string; version: number }>
> {
  try {
    ensureDb();
    const { createDraftFromApprovedProfile } = await import(
      "@/modules/profile/extract"
    );
    const result = createDraftFromApprovedProfile();
    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function approveProfileAction(
  profileId: string,
): Promise<
  ActionResult<{
    version: number;
    syncedPositioning: boolean;
    searchProfileDraftId?: string;
  }>
> {
  try {
    ensureDb();
    const { approveStructuredProfile } = await import(
      "@/modules/profile/approve"
    );
    const result = approveStructuredProfile(profileId);

    let searchProfileDraftId: string | undefined;
    try {
      const { generateSearchProfile } = await import(
        "@/modules/search-profile/generate"
      );
      const draft = await generateSearchProfile({
        trigger: "profile_approved",
      });
      searchProfileDraftId = draft.id;
    } catch (err) {
      // Non-fatal — user can generate from Search criteria page
      console.warn("search profile auto-generate failed", err);
    }

    revalidatePath("/profile");
    revalidatePath("/search-criteria");
    revalidatePath("/settings");
    return {
      ok: true,
      data: { ...result, searchProfileDraftId },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function generateSearchProfileAction(): Promise<
  ActionResult<{ id: string; version: number; usedLlm: boolean }>
> {
  try {
    ensureDb();
    const { generateSearchProfile } = await import(
      "@/modules/search-profile/generate"
    );
    const result = await generateSearchProfile({ trigger: "manual" });
    revalidatePath("/search-criteria");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function saveSearchProfileDraftAction(
  id: string,
  params: import("@/modules/search-profile/schemas").JobSearchParams,
  rationale?: string[],
): Promise<ActionResult> {
  try {
    ensureDb();
    const { saveSearchProfileDraft } = await import(
      "@/modules/search-profile/generate"
    );
    saveSearchProfileDraft(id, params, rationale);
    revalidatePath("/search-criteria");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function approveSearchProfileAction(
  id: string,
): Promise<ActionResult<{ version: number }>> {
  try {
    ensureDb();
    const { approveSearchProfile } = await import(
      "@/modules/search-profile/approve"
    );
    const result = approveSearchProfile(id);
    revalidatePath("/search-criteria");
    revalidatePath("/");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function runJobPipelineAction(): Promise<
  ActionResult<{ stats: import("@/modules/jobs/pipeline").JobPipelineStats }>
> {
  try {
    ensureDb();
    const { runJobDiscoveryPipeline } = await import(
      "@/modules/jobs/pipeline"
    );
    const stats = await runJobDiscoveryPipeline();
    revalidatePath("/");
    return { ok: true, data: { stats } };
  } catch (err) {
    return fail(err);
  }
}

export async function interestedJobAction(jobId: string): Promise<ActionResult> {
  try {
    ensureDb();
    const { interestedJob } = await import("@/modules/jobs/queries");
    interestedJob(jobId);
    revalidatePath("/");
    revalidatePath("/interested");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function rejectJobAction(
  jobId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { rejectJob } = await import("@/modules/jobs/queries");
    rejectJob(jobId, reason);
    revalidatePath("/");
    revalidatePath("/interested");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function saveJobForLaterAction(
  jobId: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { saveJobForLater } = await import("@/modules/jobs/queries");
    saveJobForLater(jobId);
    revalidatePath("/");
    revalidatePath("/interested");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function markJobAppliedAction(
  jobId: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { markJobApplied } = await import("@/modules/jobs/queries");
    markJobApplied(jobId);
    revalidatePath("/");
    revalidatePath("/interested");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function setTodayModeAction(
  mode: "jobs" | "clients",
): Promise<ActionResult> {
  try {
    ensureDb();
    const { setTodayMode } = await import("@/modules/jobs/queries");
    setTodayMode(mode);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function setJobOutcomeAction(
  jobId: string,
  outcome:
    | "no_response"
    | "recruiter_response"
    | "interview"
    | "rejected"
    | "offer"
    | "accepted",
  note?: string,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { setJobOutcome } = await import("@/modules/learning/job-outcomes");
    setJobOutcome(jobId, outcome, note);
    revalidatePath("/learning");
    revalidatePath("/");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function generateWeeklyJobInsightsAction(
  force = false,
): Promise<ActionResult<{ reportId: string }>> {
  try {
    ensureDb();
    const { generateWeeklyJobInsights } = await import(
      "@/modules/learning/job-insights"
    );
    const result = generateWeeklyJobInsights(force);
    revalidatePath("/learning");
    return { ok: true, data: { reportId: result.reportId } };
  } catch (err) {
    return fail(err);
  }
}

export async function proposeSearchStrategyAction(
  force = false,
): Promise<ActionResult<{ proposalId: string; version: number }>> {
  try {
    ensureDb();
    const { proposeSearchStrategyUpdate } = await import(
      "@/modules/learning/job-insights"
    );
    const result = await proposeSearchStrategyUpdate(force);
    revalidatePath("/learning");
    revalidatePath("/search-criteria");
    return {
      ok: true,
      data: { proposalId: result.proposalId, version: result.version },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function setAdaptiveJobRankingAction(
  enabled: boolean,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { setAdaptiveJobRanking } = await import("@/modules/jobs/queries");
    setAdaptiveJobRanking(enabled);
    revalidatePath("/learning");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function setUsePortfolioInMatchingAction(
  enabled: boolean,
): Promise<ActionResult> {
  try {
    ensureDb();
    const { setMatchingSourcesConfig } = await import(
      "@/modules/profile/matching-sources"
    );
    // Matching preference only — never deletes sources or profile knowledge.
    setMatchingSourcesConfig({ portfolioProjects: enabled });
    revalidatePath("/profile");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function reactivateSearchStrategyAction(
  version: number,
): Promise<ActionResult<{ version: number }>> {
  try {
    ensureDb();
    const { getDb } = await import("@/db/client");
    const { jobSearchProfiles } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    const { reactivateSearchProfile } = await import(
      "@/modules/search-profile/approve"
    );
    const row = getDb()
      .select()
      .from(jobSearchProfiles)
      .where(eq(jobSearchProfiles.version, version))
      .orderBy(desc(jobSearchProfiles.createdAt))
      .all()[0];
    if (!row) throw new Error(`No search profile for version ${version}`);
    const result = reactivateSearchProfile(row.id);
    revalidatePath("/learning");
    revalidatePath("/search-criteria");
    revalidatePath("/");
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

