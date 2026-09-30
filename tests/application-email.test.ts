import assert from "node:assert/strict";
import {
  applicationEmailToPlainText,
  buildApplicationEmail,
  defaultApplicationSubject,
  mailtoHref,
} from "../src/modules/applications/application-email";
import type {
  CoverLetter,
  TailoredCv,
} from "../src/modules/applications/schemas";

const cv: TailoredCv = {
  template: "projects",
  outputLanguage: "en",
  fullName: "Milos Dostanic",
  headline: "Senior Product Designer",
  email: "milos@example.com",
  phone: undefined,
  location: "Belgrade",
  links: ["https://portfolio.example"],
  summary: "Summary",
  skills: ["Figma"],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  licenses: [],
  languages: [],
  includeProjects: true,
  includeLicenses: false,
  includeLanguages: true,
  includeCertifications: true,
};

const letter: CoverLetter = {
  greeting: "Dear Hiring Team,",
  opening: "I am applying for the role.",
  body: "I bring systems thinking.",
  closing: "Happy to share a case study.",
  signOff: "Best regards,",
  fullName: "Milos Dostanic",
};

assert.equal(
  defaultApplicationSubject({
    jobTitle: "Senior Product Designer",
    fullName: "Milos Dostanic",
  }),
  "Senior Product Designer — Milos Dostanic",
);

const email = buildApplicationEmail({
  letter,
  cv,
  jobTitle: "Senior Product Designer",
  companyName: "Acme",
});
assert.equal(email.subject, "Senior Product Designer — Milos Dostanic");
assert.match(email.body, /Dear Hiring Team/);
assert.match(applicationEmailToPlainText(email), /^Subject:/m);
assert.match(mailtoHref(email), /^mailto:/);

console.log("application-email.test.ts: ok");
