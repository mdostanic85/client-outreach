import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBaseCv } from "../src/modules/applications/base-cv";
import { cvTemplateFor, visibleCvSections } from "../src/modules/applications/cv-layout";
import { tailoredCvToPlainText } from "../src/modules/applications/export-text";
import { extractHowToApply } from "../src/modules/applications/how-to-apply";
import { detectPostingLanguage } from "../src/modules/applications/language";
import { marketLabels } from "../src/modules/applications/market";
import { EMPTY_STRUCTURED_PROFILE } from "../src/modules/profile/schemas";

const driver = {
  ...EMPTY_STRUCTURED_PROFILE,
  currentRole: "Truck Driver",
  occupationFamily: "transport_logistics" as const,
  licenses: ["C", "CE", "ADR"],
  certifications: ["Digital tachograph card"],
  relevantProjects: [
    {
      title: "Truck Driver at Milšped",
      evidenceKind: "general" as const,
      organization: "Milšped",
      role: "Truck Driver",
      start: "2019",
      end: "Present",
      outcomes: ["International routes across the EU"],
      tools: [],
      sourcePointers: ["source:cv"],
    },
  ],
};

test("posting language decides the output language", () => {
  assert.equal(
    detectPostingLanguage("Tražimo vozača C kategorije za međunarodni transport. Uslovi: iskustvo na poslovima vozača, posedovanje ADR sertifikata. Nudimo stalni radni odnos i platu."),
    "sr",
  );
  assert.equal(
    detectPostingLanguage("We are looking for a Senior Product Designer to join our team. You will work with engineers and apply your experience."),
    "en",
  );
  assert.equal(marketLabels("europe", "sr").experienceHeading, "Radno iskustvo");
  assert.equal(marketLabels("europe", "en", "europass").experienceHeading, "Work experience");
});

test("how to apply pulls email, phone and form links near apply phrases", () => {
  const how = extractHowToApply(
    "Plata 150.000 RSD. Prijave slati na posao@firma.rs ili pozovite 064/123-4567. Konkurs traje do 15.10.2026. Formular: https://firma.rs/karijera/prijava",
    "https://infostud.com/posao/1",
  );
  assert.deepEqual(how.emails, ["posao@firma.rs"]);
  assert.deepEqual(how.phones, ["064/123-4567"]);
  assert.deepEqual(how.links, ["https://firma.rs/karijera/prijava"]);
  assert.equal(how.asksForLetter, false);
  assert.equal(extractHowToApply("Send your CV and a cover letter.").asksForLetter, true);
});

test("CV template follows the family", () => {
  assert.equal(cvTemplateFor("tech_digital"), "projects");
  assert.equal(cvTemplateFor("healthcare"), "credentials");
  assert.equal(cvTemplateFor("transport_logistics"), "chronological");

  const cv = buildBaseCv(driver, { fullName: "Marko Marković" }, { outputLanguage: "sr" });
  assert.equal(cv.template, "chronological");
  assert.equal(cv.outputLanguage, "sr");
  assert.deepEqual(cv.licenses, ["C", "CE", "ADR"]);
  assert.equal(cv.includeLicenses, true);
  assert.equal(cv.includeProjects, false);
  // Chronological: experience comes before skills; licences are shown.
  const sections = visibleCvSections(cv);
  assert.ok(sections.indexOf("experience") < sections.indexOf("licenses"));
  const text = tailoredCvToPlainText(cv, "europe");
  assert.match(text, /RADNO ISKUSTVO/);
  assert.match(text, /DOZVOLE I LICENCE\nC, CE, ADR/);

  const credentials = visibleCvSections({ ...cv, template: "credentials" });
  assert.equal(credentials[0] === "summary" ? credentials[1] : credentials[0], "licenses");
});
