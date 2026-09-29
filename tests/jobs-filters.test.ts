/**
 * Quick unit checks for job deterministic filters (no network).
 */
import assert from "node:assert/strict";
import { filterRawJobs } from "../src/modules/jobs/filters";
import {
  EMPTY_SEARCH_PARAMS,
  normalizeCollectorParams,
} from "../src/modules/search-profile/schemas";
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

// Bug: employmentTypes ["Remote"] used to drop every Full-time LinkedIn job.
{
  const broken = {
    ...params,
    employmentTypes: ["Remote"],
  };
  const { kept, dropped } = filterRawJobs([base], broken);
  assert.equal(kept.length, 1, "Full-time jobs must survive Remote-as-employmentType");
  assert.equal(dropped.length, 0);
}

{
  const normalized = normalizeCollectorParams({
    ...EMPTY_SEARCH_PARAMS,
    employmentTypes: ["Remote"],
    remoteRequired: false,
    remotePolicy: "any",
  });
  assert.deepEqual(normalized.employmentTypes, ["Full-time", "Contract"]);
  assert.equal(normalized.remoteRequired, true);
  assert.equal(normalized.remotePolicy, "remote_ok_required");
}

{
  const unrelated = {
    ...base,
    externalId: "4",
    title: "Senior Equine Veterinary Surgeon",
  };
  const { kept, dropped } = filterRawJobs([unrelated], params);
  assert.equal(kept.length, 0);
  assert.equal(dropped[0]?.reason, "unrelated_title");
}

{
  const ux = {
    ...base,
    externalId: "5",
    title: "Staff Product Designer, Growth",
  };
  const { kept } = filterRawJobs([ux], params);
  assert.equal(kept.length, 1);
}

{
  const uiDesigner = {
    ...base,
    externalId: "6",
    title: "Senior UI Designer",
  };
  const { kept } = filterRawJobs([uiDesigner], params);
  assert.equal(kept.length, 1, "UI Designer should pass design-oriented titleRelevant");
}

{
  const usLocRemoteDesc = {
    ...base,
    source: "linkedin" as const,
    externalId: "7",
    location: "New York, United States",
    remotePolicy: undefined,
    description:
      "Remote-friendly Product Designer role open to Europe and EMEA. Design SaaS products with Figma.",
  };
  const { kept, softFlagged, dropped } = filterRawJobs([usLocRemoteDesc], params);
  assert.equal(kept.length, 1, "US location + remote/EMEA in description should soft-flag, not drop");
  assert.equal(dropped.length, 0);
  assert.ok(
    softFlagged.some((s) => s.flags.includes("ambiguous_location")),
    "expected ambiguous_location soft flag",
  );
}

console.log("jobs-filters.test.ts OK");

// "Intern" is a whole word: International / Internal roles stay.
{
  const intl = { ...base, externalId: "intl", title: "Staff Product Designer, International" };
  const { kept } = filterRawJobs([intl], params);
  assert.equal(kept.length, 1);
}

// Boards keep roles open for weeks; a 3-week-old posting survives a 48h "posted within".
{
  const older = { ...base, externalId: "old", postedAt: new Date(Date.now() - 21 * 86400000).toISOString() };
  assert.equal(filterRawJobs([older], { ...params, postedWithinHours: 48 }).kept.length, 1);
  const stale = { ...base, externalId: "stale", postedAt: new Date(Date.now() - 45 * 86400000).toISOString() };
  assert.equal(filterRawJobs([stale], params).dropped[0]?.reason, "too_old");
}

{
  const normalized = normalizeCollectorParams({
    ...EMPTY_SEARCH_PARAMS,
    excludedKeywords: ["on-site", "internship"],
    atsBoardUrls: ["https://boards.greenhouse.io/notion", "https://jobs.lever.co/vercel"],
  });
  assert.deepEqual(normalized.excludedKeywords, ["internship"]);
  assert.deepEqual(normalized.atsBoardUrls, ["https://jobs.ashbyhq.com/notion", "https://boards.greenhouse.io/vercel"]);
}
