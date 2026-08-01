/**
 * Quick unit checks for job deterministic filters (no network).
 */
import assert from "node:assert/strict";
import { filterRawJobs } from "../src/modules/jobs/filters";
import { EMPTY_SEARCH_PARAMS } from "../src/modules/search-profile/schemas";
import type { RawCollectedJob } from "../src/modules/collectors/types";

const base: RawCollectedJob = {
  source: "remotive",
  externalId: "1",
  title: "Senior Product Designer",
  companyName: "Acme",
  location: "Remote Europe",
  remotePolicy: "remote",
  employmentType: "full_time",
  description: "Design SaaS products with Figma and design systems.",
  sourceUrl: "https://example.com/jobs/1",
  postedAt: new Date().toISOString(),
};

const params = {
  ...EMPTY_SEARCH_PARAMS,
  excludedTitles: ["Junior Designer", "Intern"],
  excludedKeywords: ["US residents only", "internship"],
  remoteRequired: true,
};

{
  const { kept, dropped } = filterRawJobs([base], params);
  assert.equal(kept.length, 1);
  assert.equal(dropped.length, 0);
}

{
  const junior = { ...base, externalId: "2", title: "Junior Designer" };
  const { kept, dropped } = filterRawJobs([junior], params);
  assert.equal(kept.length, 0);
  assert.equal(dropped[0]?.reason, "excluded_title");
}

{
  const usOnly = {
    ...base,
    externalId: "3",
    description: "Must be US residents only. On-site NYC.",
  };
  const { kept, dropped } = filterRawJobs([usOnly], params);
  assert.equal(kept.length, 0);
  assert.ok(
    dropped[0]?.reason === "excluded_keyword" ||
      dropped[0]?.reason === "bad_location" ||
      dropped[0]?.reason === "remote_required",
  );
}

console.log("jobs-filters.test.ts OK");
