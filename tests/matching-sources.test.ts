import assert from "node:assert/strict";
import {
  isPortfolioProjectEvidence,
  parseMatchingSourcesConfig,
  profileForMatching,
  type MatchingSourcesConfig,
} from "../src/modules/profile/matching-sources";
import {
  EMPTY_STRUCTURED_PROFILE,
  type StructuredProfile,
} from "../src/modules/profile/schemas";

function baseProfile(overrides: Partial<StructuredProfile> = {}): StructuredProfile {
  return {
    ...EMPTY_STRUCTURED_PROFILE,
    currentRole: "Senior Product Designer",
    strongestSkills: ["Figma", "Research"],
    relevantProjects: [
      {
        title: "Acme redesign",
        summary: "Case study",
        outcomes: [],
        tools: ["Figma"],
        sourcePointers: ["source:portfolio"],
        evidenceKind: "portfolio_project",
      },
      {
        title: "Staff product designer @ PastCo",
        summary: "Full-time role",
        outcomes: [],
        tools: [],
        sourcePointers: ["source:linkedin"],
        evidenceKind: "general",
      },
    ],
    preferredEmploymentTypes: ["full-time"],
    targetRoles: ["Staff Designer"],
    ...overrides,
  };
}

function testPortfolioToggleDoesNotStripGeneralKnowledge() {
  const profile = baseProfile();
  const config: MatchingSourcesConfig = {
    portfolioProjects: false,
    linkedin: true,
    cv: true,
    manual: true,
    github: true,
    jobPreferences: true,
    activitySignals: true,
  };
  const forMatch = profileForMatching(profile, config);

  assert.equal(forMatch.currentRole, "Senior Product Designer");
  assert.deepEqual(forMatch.strongestSkills, ["Figma", "Research"]);
  assert.equal(forMatch.relevantProjects.length, 1);
  assert.equal(forMatch.relevantProjects[0]?.title, "Staff product designer @ PastCo");
  assert.equal(profile.relevantProjects.length, 2, "stored profile unchanged");
}

function testPortfolioToggleOnKeepsProjects() {
  const profile = baseProfile();
  const forMatch = profileForMatching(profile, {
    ...parseMatchingSourcesConfig("{}"),
    portfolioProjects: true,
  });
  assert.equal(forMatch.relevantProjects.length, 2);
}

function testLegacyColumnMapsToPortfolioProjects() {
  const off = parseMatchingSourcesConfig("{}", 0);
  assert.equal(off.portfolioProjects, false);
  const on = parseMatchingSourcesConfig("{}", 1);
  assert.equal(on.portfolioProjects, true);
}

function testEvidenceKindHelpers() {
  assert.equal(
    isPortfolioProjectEvidence({
      sourcePointers: [],
      evidenceKind: "portfolio_project",
    }),
    true,
  );
  assert.equal(
    isPortfolioProjectEvidence({
      sourcePointers: ["source:portfolio"],
      evidenceKind: "general",
    }),
    false,
  );
  assert.equal(
    isPortfolioProjectEvidence({
      sourcePointers: ["source:portfolio"],
    }),
    true,
  );
}

function testJobPreferencesToggle() {
  const profile = baseProfile();
  const forMatch = profileForMatching(profile, {
    ...parseMatchingSourcesConfig("{}"),
    jobPreferences: false,
  });
  assert.deepEqual(forMatch.preferredEmploymentTypes, []);
  assert.deepEqual(forMatch.targetRoles, []);
  assert.equal(forMatch.currentRole, "Senior Product Designer");
}

testPortfolioToggleDoesNotStripGeneralKnowledge();
testPortfolioToggleOnKeepsProjects();
testLegacyColumnMapsToPortfolioProjects();
testEvidenceKindHelpers();
testJobPreferencesToggle();
console.log("matching-sources.test.ts OK");
