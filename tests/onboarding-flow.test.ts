import assert from "node:assert/strict";
import test from "node:test";
import {
  backTargetFor,
  flowOrder,
  flowProgress,
  nextStepAfter,
} from "../src/modules/onboarding/flow";

test("tech roles see levels, website and LinkedIn; healthcare skips all three", () => {
  const tech = flowOrder({ role: "Engineer", occupationFamily: "tech_digital" });
  assert.ok(tech.includes("level"));
  assert.ok(tech.includes("website"));
  assert.ok(tech.includes("linkedin"));
  assert.ok(!tech.includes("family"), "a placed role never asks for the family");

  const nurse = flowOrder({ role: "Nurse", occupationFamily: "healthcare" });
  assert.ok(!nurse.includes("level"));
  assert.ok(!nurse.includes("website"));
  assert.ok(!nurse.includes("linkedin"));
  assert.deepEqual(nurse.slice(-3), ["analyzing", "summary", "review"]);
});

test("an unplaced role asks for the family next", () => {
  assert.equal(nextStepAfter({ role: "Zookeeper" }, "role", ["intro", "role"]), "family");
});

test("a combined screen jumps past every step it covers", () => {
  const survey = { role: "Engineer", occupationFamily: "tech_digital" as const };
  assert.equal(
    nextStepAfter(survey, "experience", ["experience", "level", "engagement", "workMode"]),
    "location",
  );
  assert.equal(nextStepAfter(survey, "details", ["details", "languages", "priorities"]), "cv");
});

test("back returns to the screen before the current group", () => {
  const order = flowOrder({ role: "Engineer", occupationFamily: "tech_digital" });
  assert.equal(backTargetFor(order, "location"), "workMode");
  assert.equal(backTargetFor(order, "pay"), "workMode", "any step of a group goes back the same way");
  assert.equal(backTargetFor(order, "intro"), null);
});

test("progress counts only the groups this person sees", () => {
  const order = flowOrder({ role: "Nurse", occupationFamily: "healthcare" });
  const atRole = flowProgress(order, "role");
  assert.equal(atRole.groupIndex, 0);
  assert.equal(atRole.groupCount, 5, "no family screen for a placed role");
  assert.equal(flowProgress(order, "summary").progress, 1);
});
