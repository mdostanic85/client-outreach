import { visibleCvSections } from "./cv-layout";
import { marketLabels } from "./market";
import type { CoverLetter, PackageMarket, TailoredCv } from "./schemas";
import { coverLetterToPlainText } from "./schemas";

export function tailoredCvToPlainText(
  cv: TailoredCv,
  market: PackageMarket,
): string {
  const labels = marketLabels(market, cv.outputLanguage, cv.template);
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

  const heading = (title: string) => {
    lines.push("");
    lines.push(title.toUpperCase());
  };

  for (const id of visibleCvSections(cv)) {
    switch (id) {
      case "summary":
        heading(labels.summaryHeading);
        lines.push(cv.summary);
        break;
      case "skills":
        heading(labels.skillsHeading);
        lines.push(cv.skills.join(", "));
        break;
      case "experience":
        heading(labels.experienceHeading);
        for (const exp of cv.experience.filter((e) => e.included)) {
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
        break;
      case "projects":
        heading(labels.projectsHeading);
        for (const p of cv.projects.filter((p) => p.included)) {
          lines.push("");
          lines.push(p.title);
          if (p.summary) lines.push(p.summary);
          for (const o of p.outcomes) lines.push(`• ${o}`);
        }
        break;
      case "licenses":
        heading(labels.licensesHeading);
        lines.push(cv.licenses.join(", "));
        break;
      case "education":
        heading(labels.educationHeading);
        for (const e of cv.education) lines.push(`• ${e}`);
        break;
      case "certifications":
        heading(labels.certificationsHeading);
        for (const c of cv.certifications) lines.push(`• ${c}`);
        break;
      case "languages":
        heading(labels.languagesHeading);
        lines.push(cv.languages.join(", "));
        break;
    }
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
  const labels = marketLabels(input.market, input.cv.outputLanguage, input.cv.template);
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
