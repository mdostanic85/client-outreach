"use server";

import { revalidatePath } from "next/cache";
import { setSecret } from "@/lib/security/secrets";
import { runAction } from "@/lib/server-action";
import { approveDraft, resumeMailbox } from "./approvals";
import { disconnectMailbox, savePasswordMailboxConnection } from "./oauth-google";
import { processSendQueue } from "./send";
import { syncInbox } from "./sync";

/** The shared outbound mailbox belongs to the workspace owner. */

function revalidateMailboxSetup() {
  revalidatePath("/admin");
  revalidatePath("/queue");
}

export async function approveDraftAction(leadId: string, draftId: string) {
  return runAction("mail.approveDraft", "owner", async () => {
    const approvalId = await approveDraft(draftId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/queue");
    return { approvalId };
  });
}

export async function processSendQueueAction() {
  return runAction("mail.processSendQueue", "owner", async () => {
    const result = await processSendQueue();
    revalidatePath("/queue");
    revalidatePath("/");
    return result;
  });
}

export async function syncMailboxAction() {
  return runAction("mail.sync", "owner", async () => {
    const result = await syncInbox();
    revalidatePath("/queue");
    revalidatePath("/");
    return { fetched: result.fetched, stored: result.stored };
  });
}

export async function resumeMailboxAction() {
  return runAction("mail.resume", "owner", async () => {
    await resumeMailbox();
    revalidatePath("/queue");
    revalidatePath("/settings/voice");
  });
}

export async function saveGoogleOauthClientAction(clientId: string, clientSecret: string) {
  return runAction("mail.saveGoogleOauthClient", "owner", async () => {
    setSecret("GOOGLE_OAUTH_CLIENT_ID", clientId);
    setSecret("GOOGLE_OAUTH_CLIENT_SECRET", clientSecret);
    revalidateMailboxSetup();
  });
}

export async function saveOtherMailboxAction(input: {
  email: string;
  password: string;
  smtpHost: string;
  imapHost: string;
  smtpPort?: string;
  imapPort?: string;
}) {
  return runAction("mail.saveOtherMailbox", "owner", async () => {
    await savePasswordMailboxConnection({ ...input, provider: "custom" });
    revalidateMailboxSetup();
  });
}

export async function disconnectMailboxAction() {
  return runAction("mail.disconnect", "owner", async () => {
    disconnectMailbox();
    revalidateMailboxSetup();
  });
}
