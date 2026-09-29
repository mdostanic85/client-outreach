import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySurveyToProfile,
  applySurveyToSearchParams,
  firstOpenQuestion,
} from "../src/modules/onboarding/survey";
import { EMPTY_STRUCTURED_PROFILE } from "../src/modules/profile/schemas";
import { EMPTY_SEARCH_PARAMS } from "../src/modules/search-profile/schemas";

const survey = {
  workType: "contract" as const,
  role: "Product Designer",
  level: "senior" as const,
  workMode: "remote" as const,
  locations: ["Europe"],
  pay: { mode: "hourly" as const, currency: "EUR" as const, min: 60 },
  availability: "soon" as const,
  priorities: ["team" as const, "growth" as const],
};

test("survey answers override what the model inferred", () => {
  const profile = applySurveyToProfile(
    { ...EMPTY_STRUCTURED_PROFILE, targetRoles: ["UX Designer"], seniority: "Mid" },
    survey,
  );
  assert.deepEqual(profile.targetRoles, ["Product Designer", "UX Designer"]);
  assert.equal(profile.seniority, "Senior");
  assert.deepEqual(profile.preferredEmploymentTypes, ["Contract", "Freelance"]);
  assert.deepEqual(profile.preferredLocations, ["Remote", "Europe"]);
  assert.deepEqual(profile.compensation, { mode: "hourly", currency: "EUR", min: 60, max: null });
  assert.match(profile.workingStyle ?? "", /Strong team, Room to grow/);
});

test("survey answers shape the search", () => {
  const params = applySurveyToSearchParams(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Product Designer", "UI Designer"], locations: ["Anywhere"] },
    survey,
  );
  assert.deepEqual(params.targetTitles, ["Product Designer", "UI Designer"]);
  assert.deepEqual(params.seniority, ["Senior"]);
  assert.equal(params.remoteRequired, true);
  assert.equal(params.remotePolicy, "remote_ok_required");
  assert.deepEqual(params.locations, ["Remote", "Europe"]);
  assert.equal(params.salary?.min, 60);
});

test("a returning user resumes at the first unanswered question", () => {
  assert.equal(firstOpenQuestion({}), "intro");
  assert.equal(firstOpenQuestion({ workType: "both" }), "role");
  assert.equal(firstOpenQuestion({ ...survey, pay: undefined }), "pay");
  assert.equal(firstOpenQuestion({ ...survey, pay: null }), null);
});
