"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import { researchCompany } from "@/modules/research/run";
import {
  acceptLead,
  markLeadReplied,
  rejectLead,
  saveLeadForLater,
  setFollowUpDate,
  setLeadState,
  suppressLead,
} from "./lifecycle";
import type { LeadState } from "./states";

/** Client outreach is owner-only: every lead action requires the workspace owner. */

function revalidateLead(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
}

export async function researchLeadAction(companyId: string, leadId: string) {
  return runAction("leads.research", "owner", async () => {
    await researchCompany(companyId);
    revalidateLead(leadId);
  });
}

export async function acceptLeadAction(leadId: string) {
  return runAction("leads.accept", "owner", async () => {
    await acceptLead(leadId);
    revalidateLead(leadId);
  });
}

export async function rejectLeadAction(leadId: string, reason: string) {
  return runAction("leads.reject", "owner", async () => {
    await rejectLead(leadId, reason);
    revalidateLead(leadId);
  });
}

export async function saveForLaterAction(leadId: string) {
  return runAction("leads.saveForLater", "owner", async () => {
    await saveLeadForLater(leadId);
    revalidateLead(leadId);
  });
}

export async function markRepliedAction(leadId: string) {
  return runAction("leads.markReplied", "owner", async () => {
    await markLeadReplied(leadId);
    revalidateLead(leadId);
  });
}

export async function setFollowUpAction(leadId: string, followUpAt: string) {
  return runAction("leads.setFollowUp", "owner", async () => {
    await setFollowUpDate(leadId, followUpAt);
    revalidatePath(`/leads/${leadId}`);
  });
}

export async function suppressLeadAction(leadId: string, reason: string) {
  return runAction("leads.suppress", "owner", async () => {
    await suppressLead(leadId, reason);
    revalidateLead(leadId);
  });
}

export async function setLeadStateAction(leadId: string, state: LeadState) {
  return runAction("leads.setState", "owner", async () => {
    await setLeadState(leadId, state);
    revalidateLead(leadId);
  });
}
