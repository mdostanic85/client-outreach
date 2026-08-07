import {
  coverLetterToPlainText,
  type CoverLetter,
  type TailoredCv,
} from "@/modules/applications/schemas";

export type ApplicationEmailDraft = {
  to: string;
  subject: string;
  body: string;
};

/** Default apply-email subject — concise, ATS/recruiter friendly. */
export function defaultApplicationSubject(input: {
  jobTitle: string;
  fullName: string;
}): string {
  const role = input.jobTitle.trim() || "Role";
  const name = input.fullName.trim() || "Candidate";
  return `${role} — ${name}`;
}

/** Body mirrors the cover letter so the package stays consistent. */
export function defaultApplicationEmailBody(letter: CoverLetter): string {
  return coverLetterToPlainText(letter);
}

export function buildApplicationEmail(input: {
  letter: CoverLetter;
  cv: TailoredCv;
  jobTitle: string;
  companyName: string;
  to?: string;
}): ApplicationEmailDraft {
  return {
    to: input.to?.trim() ?? "",
    subject: defaultApplicationSubject({
      jobTitle: input.jobTitle,
      fullName: input.cv.fullName || input.letter.fullName,
    }),
    body: defaultApplicationEmailBody(input.letter),
  };
}

export function applicationEmailToPlainText(
  email: ApplicationEmailDraft,
): string {
  const lines = [
    email.to ? `To: ${email.to}` : "To:",
    `Subject: ${email.subject}`,
    "",
    email.body,
  ];
  return lines.join("\n").trim() + "\n";
}

export function mailtoHref(email: ApplicationEmailDraft): string {
  const params = new URLSearchParams();
  if (email.subject) params.set("subject", email.subject);
  if (email.body) params.set("body", email.body);
  const qs = params.toString();
  const to = email.to.trim();
  return `mailto:${encodeURIComponent(to)}${qs ? `?${qs}` : ""}`;
}
