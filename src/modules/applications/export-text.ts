import { marketLabels } from "./market";
import type { CoverLetter, PackageMarket, TailoredCv } from "./schemas";
import { coverLetterToPlainText } from "./schemas";

export function tailoredCvToPlainText(
  cv: TailoredCv,
  market: PackageMarket,
): string {
  const labels = marketLabels(market);
  const lines: string[] = [];

  lines.push(cv.fullName.toUpperCase());
  if (cv.headline) lines.push(cv.headline);

  const meta = [
    cv.location,
    cv.email,
    cv.phone,
    ...cv.links,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));

  lines.push("");
  lines.push(labels.summaryHeading.toUpperCase());
  lines.push(cv.summary);

  if (cv.skills.length) {
    lines.push("");
    lines.push(labels.skillsHeading.toUpperCase());
    lines.push(cv.skills.join(", "));
  }

  const experience = cv.experience.filter((e) => e.included);
  if (experience.length) {
    lines.push("");
    lines.push(labels.experienceHeading.toUpperCase());
    for (const exp of experience) {
      const dates = [exp.start, exp.end].filter(Boolean).join(" – ");
      lines.push("");
      lines.push(
        `${exp.role} — ${exp.organization}${dates ? ` (${dates})` : ""}`,
      );
      if (exp.location) lines.push(exp.location);
      for (const b of exp.bullets) {
        lines.push(`• ${b}`);
      }
    }
  }

  if (cv.includeProjects) {
    const projects = cv.projects.filter((p) => p.included);
    if (projects.length) {
      lines.push("");
      lines.push(labels.projectsHeading.toUpperCase());
      for (const p of projects) {
        lines.push("");
        lines.push(p.title);
        if (p.summary) lines.push(p.summary);
        for (const o of p.outcomes) lines.push(`• ${o}`);
      }
    }
  }

  if (cv.education.length) {
    lines.push("");
    lines.push(labels.educationHeading.toUpperCase());
    for (const e of cv.education) lines.push(`• ${e}`);
  }

  if (cv.includeCertifications && cv.certifications.length) {
    lines.push("");
    lines.push(labels.certificationsHeading.toUpperCase());
    for (const c of cv.certifications) lines.push(`• ${c}`);
  }

  if (cv.includeLanguages && cv.languages.length) {
    lines.push("");
    lines.push(labels.languagesHeading.toUpperCase());
    lines.push(cv.languages.join(", "));
  }

  return lines.join("\n").trim() + "\n";
}

export function packageToPlainText(input: {
  cv: TailoredCv;
  letter: CoverLetter;
  market: PackageMarket;
  companyName: string;
  jobTitle: string;
}): string {
  const labels = marketLabels(input.market);
  const cvText = tailoredCvToPlainText(input.cv, input.market);
  const letterText = coverLetterToPlainText(input.letter);

  return [
    `Application package — ${input.jobTitle} @ ${input.companyName}`,
    `${labels.documentName} + Cover letter`,
    "",
    "========== COVER LETTER ==========",
    "",
    letterText,
    "",
    `========== ${labels.documentName.toUpperCase()} ==========`,
    "",
    cvText,
  ].join("\n");
}

export function packageFilenameBase(input: {
  fullName: string;
  companyName: string;
  jobTitle: string;
}): string {
  const sanitize = (s: string) =>
    s
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40);
  const name = sanitize(input.fullName) || "Candidate";
  const company = sanitize(input.companyName) || "Company";
  const role = sanitize(input.jobTitle) || "Role";
  return `${name}_${company}_${role}`;
}
