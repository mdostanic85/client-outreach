"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import type { ContactConfidence } from "./confidence";
import { harvestLeadContacts } from "./harvest";
import { addManualContact, confirmContact } from "./manual";
import { checkDomainMx } from "./mx";
import { suggestEmailPatterns } from "./patterns";

/** Contact discovery for client outreach (owner only). Never invents addresses. */

export async function addContactAction(input: {
  companyId: string;
  leadId: string;
  name: string;
  email: string;
  role?: string;
  confidence: ContactConfidence;
}) {
  return runAction("contacts.add", "owner", async () => {
    const contactId = await addManualContact(input);
    revalidatePath(`/leads/${input.leadId}`);
    return { contactId };
  });
}

export async function confirmContactAction(contactId: string, leadId: string) {
  return runAction("contacts.confirm", "owner", async () => {
    await confirmContact(contactId, leadId);
    revalidatePath(`/leads/${leadId}`);
  });
}

export async function harvestContactsAction(leadId: string) {
  return runAction("contacts.harvest", "owner", async () => {
    const result = await harvestLeadContacts(leadId);
    revalidatePath(`/leads/${leadId}`);
    return result;
  });
}

export async function suggestPatternsAction(input: {
  leadId: string;
  companyId: string;
  fullName: string;
  domain: string;
  role?: string;
}) {
  return runAction("contacts.suggestPatterns", "owner", async () => ({
    suggestions: suggestEmailPatterns({
      fullName: input.fullName,
      domain: input.domain,
    }),
  }));
}

export async function checkMxAction(domain: string) {
  return runAction("contacts.checkMx", "owner", () => checkDomainMx(domain));
}
