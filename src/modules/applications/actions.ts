"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import type { ApplicationEmailDraft } from "./application-email";
import {
  approvePackage,
  exportPackageText,
  generatePackageForJob,
  markPackagePrepared,
  regeneratePackageSlot,
  savePackageCv,
  savePackageEmail,
  savePackageLetter,
} from "./packages";
import type { CoverLetter, TailoredCv } from "./schemas";
import { markApplicationGotReply, sendApplicationPackage } from "./send";

/**
 * Application packages (tailored CV, cover letter, email) for a saved job.
 * Each account edits its own packages; sending uses the owner's shared
 * mailbox, so only the owner can send.
 */

function revalidatePackage(jobId: string) {
  revalidatePath(`/interested/${jobId}/package`);
  revalidatePath("/interested");
}

export async function generateApplicationPackageAction(input: {
  jobId: string;
  market?: "us" | "europe";
  marketConfirmed?: boolean;
}) {
  return runAction("applications.generate", "user", async () => {
    const pkg = await generatePackageForJob(input);
    revalidatePath("/interested");
    revalidatePath(`/interested/${input.jobId}/package`);
    return { packageId: pkg.id, jobId: pkg.jobId };
  });
}

export async function savePackageCvAction(input: { packageId: string; cv: TailoredCv }) {
  return runAction("applications.saveCv", "user", async () => {
    const pkg = await savePackageCv(input.packageId, input.cv);
    revalidatePackage(pkg.jobId);
  });
}

export async function savePackageLetterAction(input: {
  packageId: string;
  letter: CoverLetter;
}) {
  return runAction("applications.saveLetter", "user", async () => {
    const pkg = await savePackageLetter(input.packageId, input.letter);
    revalidatePackage(pkg.jobId);
  });
}

export async function savePackageEmailAction(input: {
  packageId: string;
  email: ApplicationEmailDraft;
}) {
  return runAction("applications.saveEmail", "user", async () => {
    const pkg = await savePackageEmail(input.packageId, input.email);
    revalidatePackage(pkg.jobId);
    revalidatePath("/queue");
  });
}

export async function sendApplicationPackageAction(input: {
  packageId: string;
  email: ApplicationEmailDraft;
}) {
  return runAction("applications.send", "owner", async () => {
    const result = await sendApplicationPackage(input);
    if (!result.ok) throw new Error(result.reason);
    revalidatePackage(result.jobId);
    revalidatePath("/queue");
    return { jobId: result.jobId };
  });
}

export async function markApplicationGotReplyAction(packageId: string) {
  return runAction("applications.markGotReply", "user", async () => {
    const result = await markApplicationGotReply(packageId);
    revalidatePackage(result.jobId);
    revalidatePath("/queue");
  });
}

export async function regeneratePackageSlotAction(input: {
  packageId: string;
  slot: "summary" | "letter";
}) {
  return runAction("applications.regenerateSlot", "user", async () => {
    const pkg = await regeneratePackageSlot(input);
    revalidatePath(`/interested/${pkg.jobId}/package`);
  });
}

export async function approvePackageAction(packageId: string) {
  return runAction("applications.approve", "user", async () => {
    const pkg = await approvePackage(packageId);
    revalidatePackage(pkg.jobId);
  });
}

export async function markPackagePreparedAction(packageId: string) {
  return runAction("applications.markPrepared", "user", async () => {
    const pkg = await markPackagePrepared(packageId);
    revalidatePackage(pkg.jobId);
  });
}

export async function exportPackageTextAction(packageId: string) {
  return runAction("applications.exportText", "user", () => exportPackageText(packageId));
}
