import assert from "node:assert/strict";
import { checkDraftQuality } from "../src/modules/outreach/quality";
import { suggestEmailPatterns } from "../src/modules/contacts/patterns";
import { buildLookupLinks } from "../src/modules/contacts/lookup";

function testQualityPass() {
  const body = Array.from({ length: 90 }, (_, i) =>
    i === 0
      ? "Your careers page mentions a design system rebuild."
      : i === 1
        ? "I've led similar system work for product teams as Miloš Dostanić."
        : i === 2
          ? "Open to a short chat next week?"
          : "Context on fractional design leadership and product redesign.",
  ).join(" ");

  const result = checkDraftQuality({
    subject: "Design system help",
    body,
    kind: "initial",
    contactConfidence: "manual_confirmed",
    companyName: "Acme",
    evidenceExcerpts: ["design system rebuild careers page"],
  });

  assert.equal(result.ok, true, JSON.stringify(result.issues));
}

function testBannedAndPattern() {
  const result = checkDraftQuality({
    subject: "Just checking in about your roadmap sync call",
    body: "I hope this email finds you well. I wanted to reach out to leverage synergy.",
    kind: "initial",
    contactConfidence: "pattern_unverified",
  });
  assert.equal(result.ok, false);
  const codes = result.issues.map((i) => i.code);
  assert.ok(codes.includes("banned_phrase"));
  assert.ok(codes.includes("subject_too_long"));
  assert.ok(codes.includes("contact_confidence_mismatch"));
}

function testPatterns() {
  const suggestions = suggestEmailPatterns({
    fullName: "Jane Doe",
    domain: "acme.com",
  });
  assert.ok(suggestions.some((s) => s.email === "jane.doe@acme.com"));
  assert.ok(suggestions.every((s) => s.confidence === "pattern_unverified"));
}

function testLookup() {
  const links = buildLookupLinks({
    companyName: "Acme",
    domain: "acme.com",
  });
  assert.equal(links.teamPage, "https://acme.com/team");
  assert.ok(links.webSearch.includes("Acme"));
}

testQualityPass();
testBannedAndPattern();
testPatterns();
testLookup();
console.log("Phase 2 unit checks passed");
