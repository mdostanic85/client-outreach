/**
 * Five personas from docs/product/universal-jobs-plan.md (phase 7), each
 * through survey → search params → filters → scoring → CV. No network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBaseCv } from "../src/modules/applications/base-cv";
import { visibleCvSections } from "../src/modules/applications/cv-layout";
import type { RawCollectedJob } from "../src/modules/collectors/types";
import { filterRawJobs } from "../src/modules/jobs/filters";
import { applyHardRequirements, JobMatchLlmSchema } from "../src/modules/matching/evaluate";
import {
  calculateMatchScore,
  mapMatchRecommendation,
  resolveJobMatchWeights,
  type MatchDimensions,
} from "../src/modules/matching/score";
import { occupationSearchTerms, searchOccupations } from "../src/modules/occupations/search";
import {
  applySurveyToProfile,
  applySurveyToSearchParams,
  firstOpenQuestion,
  offersFreelance,
  surveySteps,
  type SurveyAnswers,
} from "../src/modules/onboarding/survey-core";
import { EMPTY_STRUCTURED_PROFILE, type StructuredProfile } from "../src/modules/profile/schemas";
import { EMPTY_SEARCH_PARAMS, type JobSearchParams } from "../src/modules/search-profile/schemas";

/** What the role step saves after the person picks from autocomplete. */
function pick(query: string): SurveyAnswers {
  const occupation = searchOccupations(query)[0];
  assert.ok(occupation, `autocomplete finds "${query}"`);
  return {
    role: occupation.en,
    occupationId: occupation.id,
    occupationFamily: occupation.family,
    occupationSynonyms: occupationSearchTerms(occupation),
  };
}

function job(title: string, extra: Partial<RawCollectedJob> = {}): RawCollectedJob {
  return {
    source: "infostud",
    externalId: title,
    title,
    companyName: "Firma",
    description: "",
    sourceUrl: `https://example.com/${encodeURIComponent(title)}`,
    postedAt: new Date().toISOString(),
    ...extra,
  };
}

function dims(score: number, nulls: Array<keyof MatchDimensions> = []): MatchDimensions {
  const all: MatchDimensions = {
    skills: { score },
    experience: { score },
    seniority: { score },
    requirements: { score },
    location: { score },
    schedule: { score },
    compensation: { score },
    evidenceFit: { score },
    industry: { score },
    language: { score },
  };
  for (const key of nulls) (all as Record<string, unknown>)[key] = null;
  return all;
}

type Persona = {
  survey: SurveyAnswers;
  profile: StructuredProfile;
  params: JobSearchParams;
};

function persona(survey: SurveyAnswers, cv: Partial<StructuredProfile> = {}): Persona {
  const done = firstOpenQuestion(survey);
  assert.equal(done, null, `survey complete (open: ${done})`);
  const profile = applySurveyToProfile({ ...EMPTY_STRUCTURED_PROFILE, ...cv }, survey);
  const params = applySurveyToSearchParams(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: [survey.role!] },
    survey,
  );
  return { survey, profile, params };
}

const common: SurveyAnswers = {
  availability: "now",
  detailsDone: true,
  languages: [{ language: "Serbian", level: "native" }],
  priorities: ["pay"],
};

test("1. developer, remote EU, GitHub", () => {
  const { survey, profile, params } = persona(
    {
      ...common,
      ...pick("backend dev"),
      experience: "5plus",
      level: "senior",
      engagement: ["full_time", "freelance"],
      workMode: "remote",
      locations: ["Europe"],
      pay: { mode: "salary", currency: "EUR", min: 60000 },
      stack: ["Node.js", "PostgreSQL"],
    },
    { currentRole: "Backend Developer", relevantProjects: [] },
  );
  assert.ok(surveySteps(survey).includes("level"));
  assert.equal(params.remoteRequired, true);
  for (const s of ["remotive", "arbeitnow", "greenhouse"] as const) assert.ok(params.sourcesEnabled.includes(s), s);
  assert.ok(params.atsBoardUrls.length > 0);
  assert.equal(offersFreelance(survey), true);

  const { kept, dropped } = filterRawJobs(
    [
      job("Senior Backend Engineer", { source: "remotive", remotePolicy: "remote", location: "Europe" }),
      job("Backend Developer", { source: "linkedin", remotePolicy: "on-site", location: "Berlin" }),
      job("Medicinska sestra", { remotePolicy: "remote" }),
    ],
    params,
  );
  assert.deepEqual(kept.map((j) => j.title), ["Senior Backend Engineer"]);
  assert.deepEqual(dropped.map((d) => d.reason).sort(), ["remote_required", "unrelated_title"]);

  assert.ok(profile.tools.includes("Node.js"));
  const cv = buildBaseCv(profile, { fullName: "Ana" });
  assert.equal(cv.template, "projects");
});

test("2. nurse, Belgrade, shifts, licence", () => {
  const { survey, profile, params } = persona(
    {
      ...common,
      ...pick("medicinska sestra"),
      experience: "5plus",
      engagement: ["full_time", "shift"],
      workMode: "onsite",
      locations: ["Belgrade"],
      commuteKm: 25,
      pay: { mode: "monthly", currency: "RSD", min: 110000 },
      professionalLicense: true,
      shifts: true,
      nights: true,
      weekends: true,
    },
    { currentRole: "Medicinska sestra", certifications: ["BLS"] },
  );
  assert.equal(survey.occupationFamily, "healthcare");
  assert.ok(!surveySteps(survey).includes("level"), "no level ladder for nurses");
  assert.equal(params.remoteRequired, false);
  assert.deepEqual([...params.sourcesEnabled].sort(), ["infostud", "linkedin", "nsz", "poslovi"]);
  assert.deepEqual(params.employmentTypes, ["Full-time", "Shift work"]);
  assert.equal(offersFreelance(survey), false);

  const { kept } = filterRawJobs(
    [
      job("Medicinska sestra/tehničar - Intenzivna nega", { location: "Beograd" }),
      job("Medicinski tehničar", { location: "Beograd" }),
      job("Računovođa", { location: "Beograd" }),
    ],
    params,
  );
  assert.deepEqual(kept.map((j) => j.title), ["Medicinska sestra/tehničar - Intenzivna nega", "Medicinski tehničar"]);

  // Licence-heavy weights; no level or portfolio in the total.
  const weights = resolveJobMatchWeights(null, "healthcare");
  assert.ok(weights.requirements >= weights.skills);
  assert.equal(calculateMatchScore(dims(80, ["seniority", "evidenceFit"]), weights), 80);

  assert.deepEqual(profile.schedule, { shifts: true, nights: true, weekends: true });
  assert.ok(profile.licenses.includes("Professional licence"));
  const cv = buildBaseCv(profile, { fullName: "Jelena" }, { outputLanguage: "sr" });
  assert.equal(cv.template, "credentials");
  assert.equal(visibleCvSections(cv)[1], "licenses", "licences right after the profile");
});

test("3. truck driver, CE + ADR, international routes", () => {
  const { survey, profile, params } = persona(
    {
      ...common,
      ...pick("vozac ce"),
      experience: "5plus",
      engagement: ["full_time"],
      workMode: "onsite",
      locations: ["Novi Sad"],
      commuteKm: 50,
      pay: { mode: "monthly", currency: "RSD", min: 150000 },
      licenses: ["C", "CE", "ADR"],
      tachographCard: true,
      internationalRoutes: true,
      shifts: true,
      nights: false,
      weekends: true,
    },
    { currentRole: "Vozač" },
  );
  assert.equal(survey.occupationId, "truck_driver");
  assert.ok(params.requiredSkills.includes("CE"));
  assert.ok(params.titleSynonyms.includes("Vozač C kategorije"));

  const { kept } = filterRawJobs(
    [
      job("Vozač C kategorije - međunarodni transport", { location: "Novi Sad" }),
      job("VOZAC CE KATEGORIJE", { location: "Novi Sad" }),
      job("Dispečer", { location: "Novi Sad" }),
    ],
    params,
  );
  assert.equal(kept.length, 2);

  // A bus job needs D: ineligible however well the rest scores.
  const raw = JobMatchLlmSchema.parse({ dimensions: dims(90, ["seniority", "evidenceFit"]), eligibility: "eligible" });
  const bus = applyHardRequirements(raw, { title: "Vozač autobusa D kategorije", description: "" }, profile.licenses);
  assert.equal(bus.eligibility, "ineligible");
  assert.equal(mapMatchRecommendation({ matchScore: 90, eligibility: bus.eligibility, remoteFit: null, remoteRequired: false }), "skip");
  // ADR required and held: no problem.
  const adr = applyHardRequirements(raw, { title: "Vozač CE kategorije", description: "ADR sertifikat je obavezan." }, profile.licenses);
  assert.equal(adr.eligibility, "eligible");

  const cv = buildBaseCv(profile, { fullName: "Marko" });
  assert.equal(cv.template, "chronological");
  assert.ok(cv.includeLicenses);
});

test("4. chef, Novi Sad, part-time and shifts", () => {
  const { survey, profile, params } = persona(
    {
      ...common,
      ...pick("kuvar"),
      experience: "2to5",
      engagement: ["part_time", "shift"],
      workMode: "onsite",
      locations: ["Novi Sad"],
      commuteKm: 10,
      pay: null,
      sanitaryBook: true,
      shifts: true,
      nights: false,
      weekends: true,
    },
    { currentRole: "Kuvar" },
  );
  assert.equal(survey.occupationFamily, "hospitality_retail");
  assert.deepEqual(params.employmentTypes, ["Part-time", "Shift work"]);
  assert.ok(profile.certifications.some((c) => /sanitar/i.test(c)));

  const { kept, dropped } = filterRawJobs(
    [
      job("Kuvar/kuvarica", { location: "Novi Sad", employmentType: "Part-time" }),
      job("Glavni kuvar", { location: "Novi Sad", employmentType: "Full-time" }),
    ],
    params,
  );
  assert.deepEqual(kept.map((j) => j.title), ["Kuvar/kuvarica"]);
  assert.equal(dropped[0]?.reason, "wrong_employment");
});

test("5. marketing manager, hybrid, Belgrade", () => {
  const { survey, params, profile } = persona(
    {
      ...common,
      ...pick("marketing manager"),
      experience: "5plus",
      level: "lead",
      engagement: ["full_time"],
      workMode: "hybrid",
      locations: ["Belgrade"],
      pay: { mode: "monthly", currency: "EUR", min: 2500 },
      stack: ["HubSpot", "Google Ads"],
      certifications: ["Google Ads certification"],
    },
    { currentRole: "Marketing Manager" },
  );
  assert.equal(survey.occupationFamily, "office_business");
  assert.ok(surveySteps(survey).includes("level"));
  assert.equal(params.remoteRequired, false);
  assert.equal(params.remotePolicy, "remote_preferred");
  // Remote boards are read too (the jobs list filters by work mode), but remote is not required.
  assert.ok(params.sourcesEnabled.includes("weworkremotely"));

  const { kept } = filterRawJobs(
    [
      job("Marketing Manager", { location: "Beograd", remotePolicy: "hybrid" }),
      job("Head of Marketing", { location: "Beograd", remotePolicy: "on-site" }),
      job("Software Engineer", { location: "Beograd" }),
    ],
    params,
  );
  assert.deepEqual(kept.map((j) => j.title), ["Marketing Manager", "Head of Marketing"]);

  const cv = buildBaseCv(profile, { fullName: "Ivana" });
  assert.equal(cv.template, "chronological");
});
