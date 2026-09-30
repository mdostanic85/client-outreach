/**
 * Unit tests for $0.50/day collector mix helpers.
 * Run: npx tsx tests/collectors-mix.test.ts
 */
import assert from "node:assert/strict";
import {
  apifyActorIdForSource,
  buildApifyInputForSource,
  canAffordApifyRun,
  DEFAULT_ACTORS,
  estimateApifyCostUsd,
} from "../src/modules/collectors/apify";
import {
  expandLinkedInQueries,
  expandRegionalQueries,
} from "../src/modules/collectors/run";
import {
  EMPTY_SEARCH_PARAMS,
  normalizeCollectorParams,
} from "../src/modules/search-profile/schemas";

function testDefaultActors() {
  assert.equal(apifyActorIdForSource("linkedin"), DEFAULT_ACTORS.linkedin);
  assert.equal(apifyActorIdForSource("helloworld"), DEFAULT_ACTORS.helloworld);
  assert.equal(apifyActorIdForSource("infostud"), DEFAULT_ACTORS.infostud);
  assert.equal(apifyActorIdForSource("greenhouse"), DEFAULT_ACTORS.ats);
}

function testLinkedInInput() {
  const input = buildApifyInputForSource(
    {
      title: "Senior Product Designer",
      location: "Remote",
      postedWithinHours: 48,
      maxResults: 12,
      source: "linkedin",
    },
    { remoteRequired: true, seniority: ["senior"] },
  );
  assert.equal(input.keywords, "Senior Product Designer");
  assert.equal(input.location, "Remote");
  assert.equal(input.maxResults, 12);
  assert.equal(input.datePosted, "past_week");
  assert.equal(input.workType, "remote");
  assert.equal(input.fetchFullDescription, true);
}

function testHelloWorldInput() {
  const input = buildApifyInputForSource(
    {
      title: "Product Designer",
      location: "Belgrade",
      postedWithinHours: 48,
      maxResults: 12,
      source: "helloworld",
    },
    { remoteRequired: true, seniority: ["senior"] },
  );
  assert.equal(input.searchQuery, "Product Designer");
  assert.equal(input.location, "Belgrade");
  assert.equal(input.seniority, "Senior");
  assert.equal(input.fetchDetails, true);
}

function testExpandLinkedIn() {
  const queries = expandLinkedInQueries({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: ["Senior Product Designer", "Product Designer"],
    locations: ["Remote", "Europe", "Serbia"],
    sourcesEnabled: ["linkedin"],
    remoteRequired: true,
  });
  assert.equal(queries.length, 3);
  assert.ok(queries.every((q) => q.source === "linkedin"));
  assert.ok(queries.some((q) => q.location === "United States"));
  assert.ok(queries.some((q) => q.location === "Serbia"));

  // On-site: follow the person's places, never the US.
  const onsite = expandLinkedInQueries({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: ["Medicinska sestra"],
    locations: ["Beograd", "Novi Sad"],
    sourcesEnabled: ["linkedin"],
  });
  assert.deepEqual(onsite.map((q) => q.location), ["Beograd", "Novi Sad"]);
}

function testExpandRegional() {
  const withHw = expandRegionalQueries({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: ["Product Designer"],
    sourcesEnabled: ["helloworld"],
  });
  assert.equal(withHw.length, 1);
  assert.equal(withHw[0]!.source, "helloworld");

  const withBoth = expandRegionalQueries({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: ["Product Designer"],
    sourcesEnabled: ["helloworld", "infostud"],
  });
  assert.equal(withBoth.length, 4);
  assert.deepEqual(
    withBoth.filter((q) => q.source === "infostud").map((q) => q.location),
    ["Beograd", "Novi Sad", "Niš"],
  );
}

function testCostEstimateUnderBudget() {
  // Rough daily mix should stay under $0.50 with soft estimates
  const ats = estimateApifyCostUsd("ats", 30);
  const li = estimateApifyCostUsd("linkedin", 36); // 3 × 12
  const hw = estimateApifyCostUsd("helloworld", 12);
  const total = ats + li + hw;
  assert.ok(total < 0.5, `expected mix estimate < 0.5, got ${total}`);
}

function testNormalizeLegacyParams() {
  const normalized = normalizeCollectorParams({
    ...EMPTY_SEARCH_PARAMS,
    sourcesEnabled: ["remotive", "arbeitnow", "greenhouse", "lever", "ashby"],
    maxDailyApifyUsd: 1.5,
    maxDailyRawJobs: 100,
    maxResultsPerQuery: 15,
  });
  assert.ok(!normalized.sourcesEnabled.includes("linkedin"));
  assert.ok(!normalized.sourcesEnabled.includes("helloworld"));
  assert.equal(normalized.maxDailyApifyUsd, 0.5);
  assert.equal(normalized.maxDailyRawJobs, 80);
  assert.equal(normalized.maxResultsPerQuery, 12);
}

function testAffordGuard() {
  assert.equal(canAffordApifyRun(0, 0.5, "linkedin"), true);
  assert.equal(canAffordApifyRun(0.49, 0.5, "linkedin"), false);
  assert.equal(canAffordApifyRun(0.49, 0.5, "ats"), false);
  assert.equal(canAffordApifyRun(0.3, 0.5, "helloworld"), true);
}

function run() {
  testDefaultActors();
  testLinkedInInput();
  testHelloWorldInput();
  testExpandLinkedIn();
  testExpandRegional();
  testCostEstimateUnderBudget();
  testNormalizeLegacyParams();
  testAffordGuard();
  console.log("collectors-mix.test.ts: ok");
}

run();
