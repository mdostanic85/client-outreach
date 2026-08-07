import assert from "node:assert/strict";
import {
  aggregateMarketGaps,
  classifyGapFixType,
  computeMarketFit,
  normalizeGapText,
} from "../src/modules/profile/market-fit";
import {
  EMPTY_STRUCTURED_PROFILE,
  type StructuredProfile,
} from "../src/modules/profile/schemas";

assert.equal(normalizeGapText("  Design Systems.  "), "design systems");
assert.equal(classifyGapFixType("Missing design systems depth"), "add_skill");
assert.equal(
  classifyGapFixType("No portfolio case study with outcomes"),
  "add_project_evidence",
);
assert.equal(classifyGapFixType("Timezone overlap with US East"), "prefs_mismatch");
assert.equal(
  classifyGapFixType("Seniority unclear vs Staff PD bar"),
  "clarify_seniority",
);

const gaps = aggregateMarketGaps([
  {
    concerns: ["Thin portfolio outcomes"],
    missingRequirements: ["Design systems"],
  },
  {
    concerns: ["Thin portfolio outcomes"],
    missingRequirements: ["Design systems", "Facilitation"],
  },
  {
    concerns: ["Other"],
    missingRequirements: ["Design systems"],
  },
]);
assert.equal(gaps[0]!.text, "Design systems");
assert.equal(gaps[0]!.count, 3);
assert.equal(gaps[0]!.matchTotal, 3);
assert.equal(gaps[1]!.text, "Thin portfolio outcomes");
assert.equal(gaps[1]!.count, 2);

const empty = computeMarketFit({
  profile: null,
  approved: false,
  sources: [],
  matches: [],
});
assert.equal(empty.label, "Beginner");
assert.ok(empty.score < 40);
assert.ok(empty.openHighImpactCount >= 3);
assert.equal(empty.pillars.some((p) => p.id === "market"), false);
assert.ok(empty.pillars.find((p) => p.id === "sources")!.score === 0);

const fullProfile: StructuredProfile = {
  ...EMPTY_STRUCTURED_PROFILE,
  currentRole: "Product Designer",
  seniority: "Senior",
  yearsExperience: 8,
  strongestSkills: [
    "Product thinking",
    "Design systems",
    "Research",
    "Prototyping",
    "Facilitation",
  ],
  designTools: ["Figma", "FigJam", "Principle"],
  targetRoles: ["Senior Product Designer"],
  strengthsAndDifferentiators: [
    "Systems thinker",
    "0→1 + scale",
  ],
  leadershipExperience: "Mentored 3 designers",
  preferredEmploymentTypes: ["full-time"],
  preferredLocations: ["Remote EU"],
  timeZones: ["CET"],
  compensation: { mode: "salary", currency: "EUR", min: 90000, max: 110000 },
  industries: ["B2B SaaS"],
  productTypes: ["Developer tools"],
  relevantProjects: [
    {
      title: "Design system rollout",
      summary: "Unified 4 products",
      outcomes: ["Cut UI debt 40%", "Ship velocity +25%"],
      tools: ["Figma"],
      sourcePointers: [],
      evidenceKind: "portfolio_project",
    },
    {
      title: "Checkout redesign",
      summary: "Conversion lift",
      outcomes: ["+12% conversion"],
      tools: ["Figma"],
      sourcePointers: [],
      evidenceKind: "portfolio_project",
    },
  ],
};

const full = computeMarketFit({
  profile: fullProfile,
  approved: true,
  sources: [
    { type: "cv" },
    { type: "linkedin_text" },
    { type: "portfolio_url" },
  ],
  matches: [],
});
assert.ok(full.score >= 85);
assert.equal(full.label, "Strong");
assert.equal(full.openHighImpactCount, 0);
assert.equal(full.pillars.find((p) => p.id === "evidence")!.score, 100);

const withMarket = computeMarketFit({
  profile: fullProfile,
  approved: true,
  sources: [
    { type: "cv" },
    { type: "portfolio_url" },
  ],
  matches: Array.from({ length: 10 }, () => ({
    concerns: ["Limited healthcare domain"],
    missingRequirements: ["Healthcare domain experience"],
  })),
});
assert.ok(withMarket.pillars.some((p) => p.id === "market"));
assert.ok(withMarket.marketGaps.length >= 1);
assert.ok(withMarket.openHighImpactCount >= 1);
assert.ok(
  withMarket.actions.some((a) => a.id.startsWith("market:")),
);

console.log("market-fit.test.ts: ok");
