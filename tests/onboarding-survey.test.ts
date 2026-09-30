import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySurveyToProfile,
  applySurveyToSearchParams,
  firstOpenQuestion,
  surveySteps,
  type SurveyAnswers,
} from "../src/modules/onboarding/survey-core";
import { EMPTY_STRUCTURED_PROFILE } from "../src/modules/profile/schemas";
import { EMPTY_SEARCH_PARAMS } from "../src/modules/search-profile/schemas";

const designer: SurveyAnswers = {
  workType: "contract",
  role: "Product Designer",
  occupationId: "product_designer",
  occupationFamily: "tech_digital",
  experience: "5plus",
  level: "senior",
  workMode: "remote",
  locations: ["Europe"],
  pay: { mode: "hourly", currency: "EUR", min: 60 },
  availability: "soon",
  detailsDone: true,
  languages: [],
  priorities: ["team", "growth"],
};

const driver: SurveyAnswers = {
  role: "Truck Driver",
  occupationId: "truck_driver",
  occupationFamily: "transport_logistics",
  experience: "5plus",
  engagement: ["full_time"],
  workMode: "onsite",
  locations: ["Novi Sad"],
  commuteKm: 50,
  pay: { mode: "monthly", currency: "RSD", min: 150000 },
  availability: "now",
  licenses: ["C", "CE", "ADR"],
  tachographCard: true,
  internationalRoutes: true,
  shifts: true,
  nights: false,
  weekends: true,
  detailsDone: true,
  languages: [{ language: "German", level: "basic" }],
  priorities: ["pay"],
};

test("survey answers override what the model inferred", () => {
  const profile = applySurveyToProfile(
    { ...EMPTY_STRUCTURED_PROFILE, targetRoles: ["UX Designer"], seniority: "Mid" },
    designer,
  );
  assert.deepEqual(profile.targetRoles, ["Product Designer", "UX Designer"]);
  assert.equal(profile.seniority, "Senior");
  assert.equal(profile.occupationFamily, "tech_digital");
  assert.deepEqual(profile.preferredEmploymentTypes, ["Contract", "Freelance"]);
  assert.deepEqual(profile.preferredLocations, ["Remote", "Europe"]);
  assert.deepEqual(profile.compensation, { mode: "hourly", currency: "EUR", min: 60, max: null });
  assert.match(profile.workingStyle ?? "", /Strong team, Room to grow/);
});

test("family answers land in the profile", () => {
  const profile = applySurveyToProfile(
    { ...EMPTY_STRUCTURED_PROFILE, languages: ["German (B2)", "English"] },
    driver,
  );
  assert.equal(profile.seniority, "5+ years");
  assert.deepEqual(profile.licenses, ["C", "CE", "ADR"]);
  assert.ok(profile.certifications.includes("Digital tachograph card"));
  assert.deepEqual(profile.schedule, { shifts: true, nights: false, weekends: true });
  assert.equal(profile.commuteRadiusKm, 50);
  assert.equal(profile.willingToTravel, true);
  assert.deepEqual(profile.languages, ["German (basic)", "English"]);
  assert.deepEqual(profile.preferredLocations, ["Novi Sad"]);
});

test("survey answers shape a remote search", () => {
  const params = applySurveyToSearchParams(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Product Designer", "UI Designer"], locations: ["Anywhere"] },
    designer,
  );
  assert.deepEqual(params.targetTitles, ["Product Designer", "UI Designer"]);
  assert.deepEqual(params.seniority, ["Senior"]);
  assert.equal(params.remoteRequired, true);
  assert.equal(params.remotePolicy, "remote_ok_required");
  assert.deepEqual(params.locations, ["Remote", "Europe"]);
  assert.equal(params.salary?.min, 60);
  assert.ok(params.sourcesEnabled.includes("remotive"));
  assert.ok(params.titleSynonyms.includes("UX Designer"));
});

test("survey answers shape an on-site search", () => {
  const params = applySurveyToSearchParams(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Truck Driver"] },
    driver,
  );
  assert.equal(params.remoteRequired, false);
  assert.deepEqual(params.locations, ["Novi Sad"]);
  assert.deepEqual(params.employmentTypes, ["Full-time"]);
  assert.equal(params.occupationFamily, "transport_logistics");
  assert.ok(params.requiredSkills.includes("CE"));
  assert.ok(params.titleSynonyms.includes("Vozač kamiona"));
  assert.deepEqual([...params.sourcesEnabled].sort(), ["infostud", "linkedin"]);
});

test("remote is ignored for families where it isn't offered", () => {
  const params = applySurveyToSearchParams(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Nurse"] },
    { ...driver, occupationId: "nurse", occupationFamily: "healthcare", workMode: "remote" },
  );
  assert.equal(params.remoteRequired, false);
});

test("steps branch on the family", () => {
  assert.ok(surveySteps(designer).includes("level"));
  assert.ok(!surveySteps(driver).includes("level"));
  // Role typed but not placed yet: ask for the family.
  assert.ok(surveySteps({ role: "Astronaut" }).includes("family"));
  assert.ok(!surveySteps(driver).includes("family"));
});

test("a returning user resumes at the first unanswered question", () => {
  assert.equal(firstOpenQuestion({}), "intro");
  assert.equal(firstOpenQuestion({ workType: "both" }), "role");
  assert.equal(firstOpenQuestion({ role: "Astronaut" }), "family");
  assert.equal(firstOpenQuestion({ ...designer, pay: undefined }), "pay");
  assert.equal(firstOpenQuestion({ ...driver, detailsDone: undefined }), "details");
  assert.equal(firstOpenQuestion({ ...designer, pay: null }), null);
  assert.equal(firstOpenQuestion(driver), null);
});
