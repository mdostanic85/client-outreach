/**
 * Unit tests for security/ops critical paths (Phase 1–3).
 * Run: npx tsx tests/unit.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { approvalContentHash } from "../src/modules/mail/approvals";
import {
  extractDomain,
  normalizeCompanyName,
} from "../src/modules/discovery/types";
import {
  effectivePolicy,
  normalizeCountryCode,
} from "../src/lib/policy/country";
import { editRatio } from "../src/modules/learning/diff";
import { CONTACT_CONFIDENCE } from "../src/modules/leads/actions";
import { canTransition } from "../src/modules/leads/transitions";
import { isGenericLocalPart } from "../src/modules/contacts/patterns";
import { calculateScoreTotal } from "../src/modules/research/schemas";
import { ResearchAndScoreSchema } from "../src/modules/research/schemas";
import { lookupViaProvider, nullContactProvider } from "../src/modules/contacts/provider";
import { redactPii } from "../src/modules/profile/redact";
import {
  StructuredProfileSchema,
  derivePositioningSummary,
} from "../src/modules/profile/schemas";
import { parseGithubUsername } from "../src/modules/profile/github";

function testNormalizeCompany() {
  assert.equal(normalizeCompanyName("Acme Inc."), "acme");
  assert.equal(normalizeCompanyName("Foo GmbH"), "foo");
  assert.equal(
    normalizeCompanyName("Design Systems Co"),
    "design systems",
  );
}

function testExtractDomain() {
  assert.equal(extractDomain("https://www.acme.com/careers"), "acme.com");
  assert.equal(extractDomain("acme.com"), "acme.com");
  assert.equal(extractDomain(null), undefined);
}

function testCountryPolicy() {
  assert.equal(normalizeCountryCode("Germany"), "DE");
  assert.equal(normalizeCountryCode("de"), "DE");
  assert.equal(normalizeCountryCode("Berlin, Germany"), "DE");
  assert.equal(effectivePolicy("unknown"), "manual_review_required");
  assert.equal(effectivePolicy("draft_allowed"), "draft_allowed");
}

function testApprovalHash() {
  const a = approvalContentHash("Hi", "Body", "a@b.com");
  const b = approvalContentHash("Hi", "Body", "A@B.com");
  const c = approvalContentHash("Hi", "Body!", "a@b.com");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
}

function testEditRatio() {
  assert.equal(editRatio("same", "same"), 0);
  assert.ok(editRatio("hello world", "hello there") > 0);
}

function testContactConfidenceStates() {
  assert.ok(CONTACT_CONFIDENCE.includes("pattern_unverified"));
  assert.ok(CONTACT_CONFIDENCE.includes("published_personal"));
  assert.ok(isGenericLocalPart("info@acme.com"));
  assert.equal(isGenericLocalPart("jane@acme.com"), false);
}

function testScoreArithmetic() {
  const total = calculateScoreTotal({
    needNow: 10,
    fit: 10,
    abilityToPay: 10,
    accessibility: 10,
    engagementMatch: 10,
  });
  assert.equal(total, 10);
  const mixed = calculateScoreTotal({
    needNow: 8,
    fit: 6,
    abilityToPay: 4,
    accessibility: 5,
    engagementMatch: 7,
  });
  assert.ok(mixed >= 6 && mixed <= 6.5, `unexpected mixed score ${mixed}`);
}

function testStateTransitions() {
  assert.equal(canTransition("suggested", "accepted"), true);
  assert.equal(canTransition("suggested", "sent"), false);
  assert.equal(canTransition("accepted", "draft_ready"), true);
  assert.equal(canTransition("closed_won", "accepted"), false);
}

async function testNullProviderPrivacy() {
  const results = await lookupViaProvider(nullContactProvider, {
    domain: "acme.com",
    fullName: "Secret Person",
  });
  assert.deepEqual(results, []);
}

function testFixturesExist() {
  const dir = path.join(process.cwd(), "tests", "fixtures");
  for (const name of [
    "remotive-sample.json",
    "arbeitnow-sample.json",
    "company-homepage.html",
    "company-team.html",
    "invalid-research.json",
    "published-emails.json",
  ]) {
    assert.ok(fs.existsSync(path.join(dir, name)), `missing fixture ${name}`);
  }
}

function testInvalidResearchFixtureRejected() {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "invalid-research.json"),
      "utf8",
    ),
  );
  const parsed = ResearchAndScoreSchema.safeParse(raw);
  assert.equal(parsed.success, false);
}

function testPublishedEmailFixture() {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "published-emails.json"),
      "utf8",
    ),
  ) as { generic: string[]; personal: string[] };
  assert.ok(raw.generic.every((e) => isGenericLocalPart(e) || e.startsWith("jobs@") || e.startsWith("hello@") || e.startsWith("info@")));
  assert.ok(raw.personal.some((e) => e.includes("jane.doe")));
}

function testProfileRedact() {
  const redacted = redactPii(
    "Call me at +381 60 123 4567 or me@example.com. DOB: 01/02/1990",
  );
  assert.match(redacted, /REDACTED_EMAIL/);
  assert.match(redacted, /REDACTED_PHONE/);
  assert.match(redacted, /REDACTED_DOB/);
  assert.doesNotMatch(redacted, /me@example\.com/);
}

function testStructuredProfileSchema() {
  const parsed = StructuredProfileSchema.parse({
    currentRole: "Product Designer",
    strongestSkills: ["Design systems"],
  });
  assert.equal(parsed.currentRole, "Product Designer");
  assert.deepEqual(parsed.industries, []);
  assert.deepEqual(parsed.relevantProjects, []);
  const summary = derivePositioningSummary(parsed);
  assert.match(summary, /Product Designer/);
}

function testParseGithubUsername() {
  assert.equal(parseGithubUsername("octocat"), "octocat");
  assert.equal(parseGithubUsername("@octocat"), "octocat");
  assert.equal(
    parseGithubUsername("https://github.com/octocat"),
    "octocat",
  );
  assert.equal(
    parseGithubUsername("https://github.com/octocat/"),
    "octocat",
  );
  assert.throws(() => parseGithubUsername("https://gitlab.com/x"), /github/i);
  assert.throws(() => parseGithubUsername(""), /Enter/);
}

const tests = [
  testNormalizeCompany,
  testExtractDomain,
  testCountryPolicy,
  testApprovalHash,
  testEditRatio,
  testContactConfidenceStates,
  testScoreArithmetic,
  testStateTransitions,
  testFixturesExist,
  testInvalidResearchFixtureRejected,
  testPublishedEmailFixture,
  testProfileRedact,
  testStructuredProfileSchema,
  testParseGithubUsername,
];

async function main() {
  for (const t of tests) {
    t();
    console.log(`ok ${t.name}`);
  }
  await testNullProviderPrivacy();
  console.log("ok testNullProviderPrivacy");
  console.log(`\n${tests.length + 1} unit tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
