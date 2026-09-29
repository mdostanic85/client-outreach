import nodemailer from "nodemailer";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { applicationPackages, jobs } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { requireMailCredentials } from "@/modules/mail/credentials";
import { getPackageById } from "./packages";
import type { ApplicationEmailDraft } from "./application-email";
import { owned } from "@/modules/auth/current-user";
import { packageFilenameBase, tailoredCvToPlainText } from "./export-text";
import { describeMailError } from "@/modules/mail/errors";

function createTransport() {
  const creds = requireMailCredentials();
  if (creds.authMode === "oauth") {
    return {
      creds,
      transport: nodemailer.createTransport({
        host: creds.smtp.host,
        port: creds.smtp.port,
        secure: creds.smtp.secure,
        auth: {
          type: "OAuth2",
          user: creds.user,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          refreshToken: creds.refreshToken,
        },
      }),
    };
  }
  return {
    creds,
    transport: nodemailer.createTransport({
      host: creds.smtp.host,
      port: creds.smtp.port,
      secure: creds.smtp.secure,
      auth: {
        user: creds.user,
        pass: creds.password,
      },
    }),
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type SendApplicationResult =
  | { ok: true; packageId: string; jobId: string }
  | { ok: false; reason: string };

/**
 * Send application email from the connected mailbox.
 * Explicit user action only — never silent.
 */
export async function sendApplicationPackage(input: {
  packageId: string;
  email: ApplicationEmailDraft;
}): Promise<SendApplicationResult> {
  const view = await getPackageById(input.packageId);
  if (!view) return { ok: false, reason: "Package not found" };
  if (view.state === "superseded") {
    return { ok: false, reason: "Package was superseded" };
  }
  if (view.state !== "approved" && view.state !== "prepared") {
    return { ok: false, reason: "Approve the package before sending" };
  }
  if (view.mailStatus === "sent" || view.mailStatus === "waiting" || view.mailStatus === "follow_up") {
    return { ok: false, reason: "This application was already sent" };
  }

  const to = input.email.to.trim().toLowerCase();
  const subject = input.email.subject.trim();
  const body = input.email.body.trim();
  if (!isValidEmail(to)) {
    return { ok: false, reason: "Enter a valid To email address" };
  }
  if (!subject) return { ok: false, reason: "Subject is required" };
  if (!body) return { ok: false, reason: "Email body is required" };

  let transportBundle: ReturnType<typeof createTransport>;
  try {
    transportBundle = createTransport();
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? err.message
          : "Mailbox not connected. Open Admin → Mailbox.",
    };
  }

  const { creds, transport } = transportBundle;
  // No PDF pipeline yet (deferred — see docs/product/company-specific-application-package.md);
  // attach the same plain-text CV the "Export .txt" button already produces so
  // the recruiter gets an actual CV file instead of only the letter-body text.
  const cvFilename = `${packageFilenameBase({
    fullName: view.cv.fullName,
    companyName: view.companyName,
    jobTitle: view.jobTitle,
  })}_CV.txt`;
  const cvText = tailoredCvToPlainText(view.cv, view.marketLabel);
  try {
    await transport.sendMail({
      from: creds.user,
      to,
      subject,
      text: body,
      headers: {
        "X-Optra-Application": "1",
      },
      attachments: [
        {
          filename: cvFilename,
          content: cvText,
          contentType: "text/plain; charset=utf-8",
        },
      ],
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Application SMTP send failed",
    );
    return {
      ok: false,
      reason: describeMailError(err, creds.smtp.host),
    };
  }

  const now = nowIso();
  const db = getDb();
  await db
    .update(applicationPackages)
    .set({
      emailTo: to,
      emailSubject: subject,
      emailBody: body,
      mailStatus: "sent",
      sentAt: now,
      state: view.state === "approved" ? "prepared" : view.state,
      updatedAt: now,
    })
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, input.packageId)));

  await db
    .update(jobs)
    .set({
      triageState: "applied",
      appliedAt: now,
      updatedAt: now,
    })
    .where(and(await owned(jobs), eq(jobs.id, view.jobId)));

  return { ok: true, packageId: input.packageId, jobId: view.jobId };
}

export async function markApplicationGotReply(
  packageId: string,
): Promise<{ packageId: string; jobId: string }> {
  const view = await getPackageById(packageId);
  if (!view) throw new Error("Package not found");
  if (
    view.mailStatus !== "sent" &&
    view.mailStatus !== "waiting" &&
    view.mailStatus !== "follow_up"
  ) {
    throw new Error("Application has not been sent yet");
  }

  const now = nowIso();
  await getDb()
    .update(applicationPackages)
    .set({
      mailStatus: "follow_up",
      repliedAt: view.repliedAt ?? now,
      updatedAt: now,
    })
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)));

  await getDb()
    .update(jobs)
    .set({
      outcome: "recruiter_response",
      outcomeAt: now,
      updatedAt: now,
    })
    .where(and(await owned(jobs), eq(jobs.id, view.jobId)));

  return { packageId, jobId: view.jobId };
}
