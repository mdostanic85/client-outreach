import assert from "node:assert/strict";
import {
  applyProfileDiffDecisions,
  diffStructuredProfiles,
  removeProfileFact,
  updateProfileFact,
} from "../src/modules/profile/diff";
import {
  EMPTY_STRUCTURED_PROFILE,
  type StructuredProfile,
} from "../src/modules/profile/schemas";

function profile(partial: Partial<StructuredProfile>): StructuredProfile {
  return { ...EMPTY_STRUCTURED_PROFILE, ...partial };
}

function testDetectsNewUpdatedConflict() {
  const baseline = profile({
    currentRole: "Product Designer",
    strongestSkills: ["Figma"],
    seniority: "Mid",
  });
  const incoming = profile({
    currentRole: "Senior Product Designer",
    strongestSkills: ["Figma", "Research"],
    seniority: "Staff",
    professionalSummary: "Builds B2B products",
  });
  const diff = diffStructuredProfiles(baseline, incoming);
  const byField = Object.fromEntries(diff.items.map((i) => [i.id, i]));

  assert.equal(byField["scalar:currentRole"]?.category, "updated");
  assert.equal(byField["scalar:seniority"]?.category, "conflict");
  assert.equal(byField["scalar:professionalSummary"]?.category, "new");
  assert.ok(
    diff.items.some(
      (i) => i.field === "strongestSkills" && i.next === "Research",
    ),
  );
}

function testApplyDecisionsMergesSelectively() {
  const baseline = profile({
    currentRole: "Product Designer",
    strongestSkills: ["Figma"],
    seniority: "Mid",
  });
  const incoming = profile({
    currentRole: "Senior Product Designer",
    strongestSkills: ["Figma", "Research"],
    seniority: "Staff",
  });
  const diff = diffStructuredProfiles(baseline, incoming);
  const decisions: Record<string, "accept" | "reject" | "keep_previous"> = {};
  for (const item of diff.items) {
    if (item.field === "seniority") decisions[item.id] = "keep_previous";
    else if (item.category === "new" || item.category === "updated") {
      decisions[item.id] = "accept";
    } else decisions[item.id] = "keep_previous";
  }

  const merged = applyProfileDiffDecisions(baseline, incoming, decisions);
  assert.equal(merged.currentRole, "Senior Product Designer");
  assert.equal(merged.seniority, "Mid");
  assert.ok(merged.strongestSkills.includes("Research"));
  assert.ok(merged.strongestSkills.includes("Figma"));
}

function testRemoveAndUpdateFacts() {
  const base = profile({
    currentRole: "Designer",
    strongestSkills: ["Figma", "FigJam"],
    relevantProjects: [
      {
        title: "Acme",
        summary: "Old",
        outcomes: [],
        tools: [],
        sourcePointers: ["source:portfolio"],
        evidenceKind: "portfolio_project",
      },
    ],
  });

  const withoutSkill = removeProfileFact(base, {
    field: "strongestSkills",
    value: "FigJam",
  });
  assert.deepEqual(withoutSkill.strongestSkills, ["Figma"]);

  const updated = updateProfileFact(base, {
    field: "relevantProjects",
    projectTitle: "Acme",
    value: "New summary",
  });
  assert.equal(updated.relevantProjects[0]?.summary, "New summary");
  assert.equal(base.relevantProjects[0]?.summary, "Old", "immutable");
}

testDetectsNewUpdatedConflict();
testApplyDecisionsMergesSelectively();
testRemoveAndUpdateFacts();
console.log("profile-diff.test.ts OK");
