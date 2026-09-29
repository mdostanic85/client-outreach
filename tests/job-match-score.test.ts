/**
 * Unit tests for weighted job match scoring.
 * Run: npx tsx tests/job-match-score.test.ts
 */
import assert from "node:assert/strict";
import {
  JOB_MATCH_WEIGHTS,
  calculateMatchScore,
  finalizeMatchScore,
  mapMatchRecommendation,
  resolveJobMatchWeights,
  type MatchDimensions,
} from "../src/modules/matching/score";
import { STRONG_MATCH_MIN, WORTH_A_LOOK_MIN } from "../src/modules/matching/tiers";

function dim(score: number, evidence?: string) {
  return { score, evidence };
}

function allDims(overrides: Partial<MatchDimensions> = {}): MatchDimensions {
  return {
    skills: dim(80),
    seniority: dim(80),
    experience: dim(80),
    locationTimezone: dim(80),
    employmentType: dim(80),
    compensation: dim(80),
    industry: dim(80),
    portfolioFit: dim(80),
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
    allDims({ locationTimezone: dim(90) }),
    {
      eligibility: "eligible",
      remoteFit: { status: "unclear", timezoneOverlap: "partial" },
      remoteRequired: true,
    },
  );
  assert.equal(dimensions.locationTimezone.score, 55);
  assert.ok(matchScore < 80);
}

function testPoorTimezoneCapWhenPass() {
  const { dimensions } = finalizeMatchScore(
    allDims({ locationTimezone: dim(90) }),
    {
      eligibility: "eligible",
      remoteFit: { status: "pass", timezoneOverlap: "poor" },
      remoteRequired: true,
    },
  );
  assert.equal(dimensions.locationTimezone.score, 65);
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
      seniority: dim(50),
      experience: dim(50),
      locationTimezone: dim(50),
      employmentType: dim(50),
      compensation: null,
      industry: dim(50),
      portfolioFit: dim(50),
      language: dim(50),
    }),
  );
  assert.equal(score, 50);
}

const tests = [
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
