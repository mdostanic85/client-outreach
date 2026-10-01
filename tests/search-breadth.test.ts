import assert from "node:assert/strict";
import test from "node:test";
import { buildApifyInputForSource } from "../src/modules/collectors/apify";
import type { RawCollectedJob } from "../src/modules/collectors/types";
import { rankForEvaluation } from "../src/modules/jobs/evaluation-order";
import { filterRawJobs } from "../src/modules/jobs/filters";
import { carryOverPreferences } from "../src/modules/profile/rebuild";
import { EMPTY_STRUCTURED_PROFILE, type StructuredProfile } from "../src/modules/profile/schemas";
import { EMPTY_SEARCH_PARAMS, type JobSearchParams } from "../src/modules/search-profile/schemas";
import {
  MAX_TARGET_TITLES,
  softenInferredFilters,
  spreadTitles,
  widenFromApproved,
} from "../src/modules/search-profile/widen";

/**
 * Adding a CV, a website or LinkedIn must widen job search, never narrow it.
 */

const approved: JobSearchParams = {
  ...EMPTY_SEARCH_PARAMS,
  targetTitles: ["Product Designer", "UX Designer"],
  titleSynonyms: ["Dizajner proizvoda"],
  excludedTitles: ["Graphic Designer"],
  locations: ["Serbia"],
  employmentTypes: ["Full-time"],
  sourcesEnabled: ["infostud", "linkedin"],
  remoteRequired: false,
  remotePolicy: "any",
  maxDailyRawJobs: 80,
};

/** What a generator might return after reading a website that says "Remote · Design systems". */
const regenerated: JobSearchParams = {
  ...EMPTY_SEARCH_PARAMS,
  targetTitles: ["Senior Product Designer, Design Systems"],
  titleSynonyms: ["Design Systems Designer"],
  excludedTitles: ["Graphic Designer", "UI Designer", "Junior Designer"],
  locations: ["Remote"],
  employmentTypes: ["Contract"],
  sourcesEnabled: ["remotive", "linkedin"],
  remoteRequired: true,
  remotePolicy: "remote_ok_required",
  seniority: ["senior"],
  maxDailyRawJobs: 60,
};

test("regenerated criteria keep every approved title, place and source and add the new ones", () => {
  const next = widenFromApproved(regenerated, approved);
  assert.deepEqual(next.targetTitles, [
    "Product Designer",
    "UX Designer",
    "Senior Product Designer, Design Systems",
  ]);
  assert.ok(next.titleSynonyms.includes("Dizajner proizvoda"));
  assert.ok(next.titleSynonyms.includes("Design Systems Designer"));
  assert.deepEqual(next.locations, ["Serbia", "Remote"]);
  assert.deepEqual(next.employmentTypes, ["Full-time", "Contract"]);
  assert.deepEqual(next.sourcesEnabled, ["infostud", "linkedin", "remotive"]);
  assert.equal(next.maxDailyRawJobs, 80, "limits never shrink");
});

test("filters stay as the person approved them; documents can't add exclusions or remote-only", () => {
  const next = widenFromApproved(regenerated, approved);
  assert.deepEqual(next.excludedTitles, ["Graphic Designer"]);
  assert.equal(next.remoteRequired, false);
  assert.equal(next.remotePolicy, "any");
  assert.deepEqual(next.seniority, []);
});

test("titles beyond the query budget become synonyms instead of being dropped", () => {
  const titles = ["A1 Designer", "B2 Designer", "C3 Designer", "D4 Designer", "E5 Designer", "F6 Designer", "G7 Designer"];
  const spread = spreadTitles(titles, ["H8 Designer", "a1 designer"]);
  assert.equal(spread.targetTitles.length, MAX_TARGET_TITLES);
  assert.deepEqual(spread.titleSynonyms, ["F6 Designer", "G7 Designer", "H8 Designer"]);
});

test("a remote-only filter inferred from documents becomes a preference", () => {
  const soft = softenInferredFilters(regenerated, { remoteOnly: undefined });
  assert.equal(soft.remoteRequired, false);
  assert.equal(soft.remotePolicy, "remote_preferred");
  const chosen = softenInferredFilters(regenerated, { remoteOnly: true });
  assert.equal(chosen.remoteRequired, true, "a survey answer stays a hard filter");
});

function job(title: string, extra: Partial<RawCollectedJob> = {}): RawCollectedJob {
  return {
    source: "linkedin",
    externalId: title,
    title,
    companyName: "Acme",
    description: "Build the product.",
    sourceUrl: `https://example.com/${encodeURIComponent(title)}`,
    location: "Belgrade",
    remotePolicy: "hybrid",
    postedAt: new Date().toISOString(),
    ...extra,
  };
}

const postings = [
  job("Product Designer"),
  job("UX Designer"),
  job("Senior Product Designer, Design Systems"),
  job("Dizajner proizvoda"),
  job("Design Systems Designer", { remotePolicy: "remote", location: "Remote" }),
  job("Graphic Designer"),
  job("Accountant"),
];

test("widened criteria keep every job the approved criteria kept (and more)", () => {
  const before = new Set(filterRawJobs(postings, approved).kept.map((j) => j.title));
  const after = new Set(filterRawJobs(postings, widenFromApproved(regenerated, approved)).kept.map((j) => j.title));
  for (const title of before) assert.ok(after.has(title), `${title} must still pass`);
  assert.ok(after.size > before.size, "the new titles add jobs");
  assert.ok(!after.has("Graphic Designer"), "the person's own exclusion still applies");
  assert.ok(!after.has("Accountant"));
});

test("without the widening, the regenerated criteria alone would have dropped hybrid jobs", () => {
  const alone = new Set(filterRawJobs(postings, regenerated).kept.map((j) => j.title));
  assert.ok(!alone.has("Product Designer"), "this is the narrowing the rules prevent");
});

const approvedProfile: StructuredProfile = {
  ...EMPTY_STRUCTURED_PROFILE,
  targetRoles: ["Product Designer"],
  preferredLocations: ["Belgrade", "Hybrid"],
  licenses: ["B"],
  rolesBelowLevel: [],
  occupationFamily: "tech_digital",
  compensation: { mode: "monthly", currency: "EUR", min: 2000, max: null },
};

test("rebuilding the profile from a new website keeps the person's roles, places and pay", () => {
  const fromWebsite: StructuredProfile = {
    ...EMPTY_STRUCTURED_PROFILE,
    targetRoles: ["Design Systems Lead"],
    preferredLocations: ["Remote"],
    rolesBelowLevel: ["UX Designer"],
    strongestSkills: ["Design systems"],
  };
  const merged = carryOverPreferences(fromWebsite, approvedProfile);
  assert.deepEqual(merged.targetRoles, ["Product Designer", "Design Systems Lead"]);
  assert.deepEqual(merged.preferredLocations, ["Belgrade", "Hybrid", "Remote"]);
  assert.deepEqual(merged.licenses, ["B"]);
  assert.deepEqual(merged.rolesBelowLevel, [], "a document can't add exclusions");
  assert.equal(merged.compensation?.min, 2000);
  assert.equal(merged.occupationFamily, "tech_digital");
  assert.deepEqual(merged.strongestSkills, ["Design systems"], "evidence comes from the sources");
  assert.equal(carryOverPreferences(fromWebsite, null), fromWebsite, "first profile: nothing to keep");
});

test("AI scoring budget goes to the best title matches, taking turns across sources", () => {
  const ats = [1, 2, 3, 4].map((n) => job(`Designer ${n}`, { source: "greenhouse", externalId: `g${n}` }));
  const linkedin = job("Product Designer", { source: "linkedin", externalId: "l1" });
  const ordered = rankForEvaluation([...ats, linkedin], approved);
  assert.equal(ordered[0]!.title, "Product Designer", "exact title match first");
  assert.equal(ordered[1]!.source, "greenhouse");
  assert.equal(ordered.length, 5);
});

test("board searches use the title alone; skills don't narrow them", () => {
  const input = buildApifyInputForSource(
    {
      title: "Product Designer",
      location: "Serbia",
      postedWithinHours: 168,
      maxResults: 12,
      source: "greenhouse",
      keywords: ["Figma", "Prototyping"],
    },
    { remoteRequired: false, seniority: [] },
  ) as Record<string, unknown>;
  assert.equal(input.search, "Product Designer");
  assert.deepEqual(input.keywords, ["Figma", "Prototyping"]);
});

test("remote-only follows the survey answer, also for criteria approved earlier", async () => {
  const { applyRemoteChoice } = await import("../src/modules/onboarding/survey-core");
  const inferred = { ...approved, remoteRequired: true, remotePolicy: "remote_ok_required" as const };
  assert.equal(applyRemoteChoice(inferred, {}).remoteRequired, false, "no answer: a preference only");
  assert.equal(applyRemoteChoice(inferred, {}).remotePolicy, "remote_preferred");
  assert.equal(
    applyRemoteChoice(inferred, { workMode: "hybrid", occupationFamily: "tech_digital" }).remoteRequired,
    false,
  );
  const remote = applyRemoteChoice(approved, { workMode: "remote", occupationFamily: "tech_digital" });
  assert.equal(remote.remoteRequired, true, "the person asked for remote-only");
  assert.equal(remote.remotePolicy, "remote_ok_required");
});
