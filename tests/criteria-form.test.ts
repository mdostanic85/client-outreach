import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POSTED_WITHIN_HOURS,
  formValuesToParams,
  paramsToFormValues,
} from "../src/modules/search-profile/criteria-form";
import type { JobSearchParams } from "../src/modules/search-profile/schemas";

const base = {
  targetTitles: ["Product Designer"],
  titleSynonyms: ["UX Designer"],
  excludedTitles: [],
  locations: ["Remote"],
  employmentTypes: ["Full-time"],
  postedWithinHours: 72,
  searchKeywords: [],
  excludedKeywords: [],
  requiredSkills: ["Figma"],
  preferredSkills: [],
  seniority: [],
  remoteRequired: true,
  remotePolicy: "remote_ok_required",
  priorityIndustries: [],
  avoidIndustries: [],
  atsBoardUrls: [],
  sourcesEnabled: ["greenhouse", "remotive"],
  maxResultsPerQuery: 12,
  maxDailyRawJobs: 80,
  maxDailyApifyUsd: 0.5,
} as unknown as JobSearchParams;

test("the form edits titles and limits and keeps everything else", () => {
  const values = paramsToFormValues(base);
  assert.equal(values.postedWithinDays, "3");
  const next = formValuesToParams(
    { ...values, titles: "Product Designer\n UX Lead ", postedWithinDays: "7" },
    base,
  );
  assert.deepEqual(next.targetTitles, ["Product Designer", "UX Lead"]);
  assert.equal(next.postedWithinHours, 168);
  assert.deepEqual(next.sourcesEnabled, ["greenhouse", "remotive"], "source choice survives the form");
  assert.equal(next.remoteRequired, true);
  assert.deepEqual(next.requiredSkills, ["Figma"]);
});

test("blank or invalid numbers fall back to the defaults", () => {
  const values = { ...paramsToFormValues(base), postedWithinDays: "", maxRaw: "lots", maxApify: "" };
  const next = formValuesToParams(values, base);
  assert.equal(next.postedWithinHours, DEFAULT_POSTED_WITHIN_HOURS);
  assert.equal(next.maxDailyRawJobs, 80);
  assert.equal(next.maxDailyApifyUsd, 0.5);
});
