import assert from "node:assert/strict";
import { test } from "node:test";
import { ESTIMATE_MAX, estimateJobScore, type EstimateCriteria } from "../src/modules/matching/quick-estimate";
import { STRONG_MATCH_MIN } from "../src/modules/matching/tiers";

const criteria: EstimateCriteria = {
  targetTitles: ["Product Designer"],
  titleSynonyms: ["UX Designer", "UI/UX Designer"],
  skills: ["Figma", "design systems", "prototyping"],
  seniority: ["Senior"],
};

test("an estimate never reaches the strong-match bar", () => {
  assert.ok(ESTIMATE_MAX < STRONG_MATCH_MIN);
  const best = estimateJobScore(
    { title: "Senior Product Designer", description: "Figma, design systems and prototyping" },
    criteria,
    "ok",
  );
  assert.equal(best.score, ESTIMATE_MAX);
});

test("same title with the skills outranks a related title without them", () => {
  const strong = estimateJobScore({ title: "Product Designer", description: "Figma and prototyping" }, criteria, "ok");
  const weak = estimateJobScore({ title: "Graphic Designer", description: "Posters" }, criteria, "ok");
  assert.ok(strong.score > weak.score + 20, `${strong.score} vs ${weak.score}`);
  assert.match(strong.basis, /same title/);
  assert.match(strong.basis, /2 of 3 skills/);
});

test("synonym titles score between exact and unrelated", () => {
  const exact = estimateJobScore({ title: "Product Designer" }, criteria, "ok").score;
  const synonym = estimateJobScore({ title: "UX Designer" }, criteria, "ok").score;
  const other = estimateJobScore({ title: "Account Executive" }, criteria, "ok").score;
  assert.ok(exact > synonym && synonym > other);
});

test("an unclear work location costs points and is named", () => {
  const ok = estimateJobScore({ title: "Product Designer" }, criteria, "ok");
  const unclear = estimateJobScore({ title: "Product Designer" }, criteria, "unclear");
  assert.ok(ok.score > unclear.score);
  assert.match(unclear.basis, /work location unclear/);
});

test("a level that differs from the wanted one scores lower", () => {
  const match = estimateJobScore({ title: "Senior Product Designer" }, criteria, "ok").score;
  const junior = estimateJobScore({ title: "Junior Product Designer" }, criteria, "ok").score;
  assert.ok(match > junior);
});

test("with no skills in the criteria the skill part is neutral, not zero", () => {
  const noSkills = estimateJobScore({ title: "Product Designer" }, { ...criteria, skills: [] }, "ok");
  assert.ok(noSkills.score >= 50);
});
