"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import { researchCompany } from "@/modules/research/run";
import { discoverAndPersistOne, submitManualCompany } from "./persist";

/** Company discovery for client outreach (owner only): find a company, open a lead, research it. */

function revalidateNewLead(leadId: string) {
  revalidatePath("/");
  revalidatePath(`/leads/${leadId}`);
}

/** One end-to-end pass: fetch hiring signals, persist the first new company, research it. */
export async function runVerticalSliceAction() {
  return runAction("discovery.verticalSlice", "owner", async () => {
    const persisted = await discoverAndPersistOne({ preferDomain: true });
    if (!persisted) throw new Error("No Remotive signals available");
    await researchCompany(persisted.companyId);
    revalidateNewLead(persisted.leadId);
    return { leadId: persisted.leadId, companyId: persisted.companyId };
  });
}

export async function submitManualCompanyAction(input: {
  companyName: string;
  companyUrl: string;
  title?: string;
  location?: string;
  researchNow?: boolean;
}) {
  return runAction("discovery.submitManualCompany", "owner", async () => {
    const persisted = await submitManualCompany(input);
    if (input.researchNow !== false) {
      await researchCompany(persisted.companyId);
    }
    revalidateNewLead(persisted.leadId);
    return { leadId: persisted.leadId, companyId: persisted.companyId };
  });
}
