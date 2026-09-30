/**
 * Unit tests for weighted job match scoring.
 * Run: npx tsx tests/job-match-score.test.ts
 */
import assert from "node:assert/strict";
import {
  FAMILY_MATCH_WEIGHTS,
  JOB_MATCH_DIM_KEYS,
  JOB_MATCH_WEIGHTS,
  MatchDimensionsSchema,
  calculateMatchScore,
  finalizeMatchScore,
  mapMatchRecommendation,
  resolveJobMatchWeights,
  type MatchDimensions,
} from "../src/modules/matching/score";
import { STRONG_MATCH_MIN, WORTH_A_LOOK_MIN } from "../src/modules/matching/tiers";
import { OCCUPATION_FAMILIES } from "../src/modules/occupations/families";
import { missingMandatoryLicences } from "../src/modules/matching/requirements";
import { applyHardRequirements, JobMatchLlmSchema } from "../src/modules/matching/evaluate";

function dim(score: number, evidence?: string) {
  return { score, evidence };
}

function allDims(overrides: Partial<MatchDimensions> = {}): MatchDimensions {
  return {
    skills: dim(80),
    experience: dim(80),
    seniority: dim(80),
    requirements: dim(80),
    location: dim(80),
    schedule: dim(80),
    compensation: dim(80),
    evidenceFit: dim(80),
    industry: dim(80),
    language: dim(80),
    ...overrides,
  };
}

function testUniformScore() {
  assert.equal(calculateMatchScore(allDims()), 80);
}

function testNullCompensationRenormalize() {
  const withComp = calculateMatchScore(allDims({ compensation: dim(0) }));
  const withoutComp = calculateMatchScore(allDims({ compensation: null }));
  // Excluding a zero compensation dim should raise the total (renormalize).
  assert.ok(
    withoutComp > withComp,
    `expected ${withoutComp} > ${withComp}`,
  );
  // All non-null at 80 → still 80 when compensation null.
  assert.equal(withoutComp, 80);
}

function testWeightedSkillsDominate() {
  const lowSkills = calculateMatchScore(
    allDims({ skills: dim(20), compensation: null }),
  );
  const highSkills = calculateMatchScore(
    allDims({ skills: dim(100), compensation: null }),
  );
  assert.ok(highSkills > lowSkills);
  assert.ok(highSkills - lowSkills > 15);
}

function testResolveWeightsMerge() {
  const w = resolveJobMatchWeights({ skills: 40 });
  assert.equal(w.skills, 40);
  assert.equal(w.seniority, JOB_MATCH_WEIGHTS.seniority);
}

function testUnclearRemoteCapsLocation() {
  const { dimensions, matchScore } = finalizeMatchScore(
    allDims({ location: dim(90) }),
    {
      eligibility: "eligible",
      remoteFit: { status: "unclear", timezoneOverlap: "partial" },
      remoteRequired: true,
    },
  );
  assert.equal(dimensions.location.score, 55);
  assert.ok(matchScore < 80);
}

function testPoorTimezoneCapWhenPass() {
  const { dimensions } = finalizeMatchScore(
    allDims({ location: dim(90) }),
    {
      eligibility: "eligible",
      remoteFit: { status: "pass", timezoneOverlap: "poor" },
      remoteRequired: true,
    },
  );
  assert.equal(dimensions.location.score, 65);
}

function testBorderlineCapsAt69() {
  const { matchScore } = finalizeMatchScore(allDims({ compensation: null }), {
    eligibility: "borderline",
    remoteFit: { status: "pass", timezoneOverlap: "full" },
    remoteRequired: true,
  });
  assert.equal(matchScore, STRONG_MATCH_MIN - 1);
  assert.ok(matchScore < STRONG_MATCH_MIN);
}

function testRecommendationMapping() {
  assert.equal(
    mapMatchRecommendation({
      matchScore: 75,
      eligibility: "eligible",
      remoteFit: { status: "pass" },
      remoteRequired: true,
    }),
    "apply",
  );
  assert.equal(
    mapMatchRecommendation({
      matchScore: 60,
      eligibility: "eligible",
      remoteFit: { status: "pass" },
      remoteRequired: true,
    }),
    "consider",
  );
  assert.equal(
    mapMatchRecommendation({
      matchScore: 90,
      eligibility: "ineligible",
      remoteFit: { status: "pass" },
      remoteRequired: true,
    }),
    "skip",
  );
  assert.equal(
    mapMatchRecommendation({
      matchScore: 90,
      eligibility: "eligible",
      remoteFit: { status: "fail" },
      remoteRequired: true,
    }),
    "skip",
  );
  assert.equal(
    mapMatchRecommendation({
      matchScore: 90,
      eligibility: "eligible",
      remoteFit: { status: "unclear" },
      remoteRequired: true,
    }),
    "consider",
  );
  assert.equal(
    mapMatchRecommendation({
      matchScore: WORTH_A_LOOK_MIN - 1,
      eligibility: "eligible",
      remoteFit: { status: "pass" },
      remoteRequired: false,
    }),
    "skip",
  );
}

function testModelTotalIgnoredViaCodePath() {
  // Even if dims are mid and someone would claim 95, code total follows dims.
  const score = calculateMatchScore(
    allDims({
      skills: dim(50),
      experience: dim(50),
      seniority: dim(50),
      requirements: dim(50),
      location: dim(50),
      schedule: dim(50),
      compensation: null,
      evidenceFit: dim(50),
      industry: dim(50),
      language: dim(50),
    }),
  );
  assert.equal(score, 50);
}

function testFamilyWeightsSumTo100() {
  const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
  assert.equal(sum(JOB_MATCH_WEIGHTS), 100);
  for (const family of OCCUPATION_FAMILIES) {
    assert.equal(sum(FAMILY_MATCH_WEIGHTS[family]), 100, family);
    assert.deepEqual(Object.keys(FAMILY_MATCH_WEIGHTS[family]).sort(), [...JOB_MATCH_DIM_KEYS].sort());
  }
  // Drivers: licences and location outweigh skills; tech: the reverse.
  const t = FAMILY_MATCH_WEIGHTS.transport_logistics;
  assert.ok(t.requirements > t.skills && t.location > t.skills);
  assert.ok(FAMILY_MATCH_WEIGHTS.tech_digital.skills > FAMILY_MATCH_WEIGHTS.tech_digital.requirements);
  // Family defaults apply when nothing is stored; stored values still win.
  assert.equal(resolveJobMatchWeights(null, "healthcare").requirements, 25);
  assert.equal(resolveJobMatchWeights({ requirements: 5 }, "healthcare").requirements, 5);
}

function testLegacyKeysStillParse() {
  const parsed = MatchDimensionsSchema.parse({
    skills: dim(90),
    seniority: dim(80),
    experience: dim(70),
    locationTimezone: dim(60),
    employmentType: dim(50),
    compensation: null,
    industry: dim(40),
    portfolioFit: dim(30),
    language: dim(20),
  });
  assert.equal(parsed.location.score, 60);
  assert.equal(parsed.schedule?.score, 50);
  assert.equal(parsed.evidenceFit?.score, 30);
  assert.equal(parsed.requirements, null);
  // Old stored weights keep their meaning.
  assert.equal(resolveJobMatchWeights({ locationTimezone: 33 } as never).location, 33);
}

function testNullDimsDropOut() {
  // A driver: no level, no portfolio, no industry signal.
  const score = calculateMatchScore(
    allDims({ seniority: null, evidenceFit: null, industry: null }),
    FAMILY_MATCH_WEIGHTS.transport_logistics,
  );
  assert.equal(score, 80);
}

function testMandatoryLicenceMakesIneligible() {
  assert.deepEqual(
    missingMandatoryLicences({ title: "Vozač CE kategorije", description: "", licences: ["C"] }),
    ["Driving licence CE"],
  );
  assert.deepEqual(
    missingMandatoryLicences({ title: "Vozač C kategorije", description: "", licences: ["CE"] }),
    [],
    "CE covers C",
  );
  assert.deepEqual(
    missingMandatoryLicences({ title: "Vozač", description: "Uslovi: ADR sertifikat je obavezan.", licences: ["CE"] }),
    ["ADR certificate"],
  );
  assert.deepEqual(
    missingMandatoryLicences({ title: "Magacioner", description: "B kategorija je prednost.", licences: ["B"] }),
    [],
  );
  assert.deepEqual(
    missingMandatoryLicences({ title: "Vozač CE kategorije", description: "", licences: [] }),
    [],
    "unknown licences: leave it to the model",
  );

  const raw = JobMatchLlmSchema.parse({
    dimensions: allDims({ requirements: dim(90) }),
    eligibility: "eligible",
  });
  const checked = applyHardRequirements(raw, { title: "Vozač CE kategorije", description: "" }, ["C"]);
  assert.equal(checked.eligibility, "ineligible");
  assert.equal(checked.dimensions.requirements?.score, 10);
  assert.ok(checked.concerns.some((c) => c.includes("CE")));
  assert.equal(
    mapMatchRecommendation({ matchScore: 95, eligibility: checked.eligibility, remoteFit: null, remoteRequired: false }),
    "skip",
  );
  const modelFlagged = applyHardRequirements(
    { ...raw, mandatoryMissing: ["Nursing licence"] },
    { title: "Medicinska sestra", description: "" },
    [],
  );
  assert.equal(modelFlagged.eligibility, "ineligible");
}

const tests = [
  testFamilyWeightsSumTo100,
  testLegacyKeysStillParse,
  testNullDimsDropOut,
  testMandatoryLicenceMakesIneligible,
  testUniformScore,
  testNullCompensationRenormalize,
  testWeightedSkillsDominate,
  testResolveWeightsMerge,
  testUnclearRemoteCapsLocation,
  testPoorTimezoneCapWhenPass,
  testBorderlineCapsAt69,
  testRecommendationMapping,
  testModelTotalIgnoredViaCodePath,
];

for (const t of tests) {
  t();
  console.log(`ok ${t.name}`);
}
console.log(`\n${tests.length} job-match score tests passed`);
