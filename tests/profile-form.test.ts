import assert from "node:assert/strict";
import test from "node:test";
import {
  formValuesToProfile,
  linesToList,
  profileToFormValues,
} from "../src/modules/profile/profile-form";
import { EMPTY_STRUCTURED_PROFILE, type StructuredProfile } from "../src/modules/profile/schemas";

const profile: StructuredProfile = {
  ...EMPTY_STRUCTURED_PROFILE,
  currentRole: "Product Designer",
  yearsExperience: 7,
  strongestSkills: ["Design systems", "Prototyping"],
  targetRoles: ["Senior Product Designer"],
  relevantProjects: [],
  education: [{ school: "FTN", degree: "BSc" }] as StructuredProfile["education"],
};

test("form values round-trip to the same profile fields", () => {
  const values = profileToFormValues(profile);
  assert.equal(values.strongestSkills, "Design systems\nPrototyping");
  assert.equal(values.yearsExperience, "7");
  const back = formValuesToProfile(values, profile);
  assert.deepEqual(back.strongestSkills, profile.strongestSkills);
  assert.equal(back.yearsExperience, 7);
  assert.deepEqual(back.education, profile.education, "fields the form does not show are kept");
});

test("blank text becomes undefined, list lines are trimmed", () => {
  const values = { ...profileToFormValues(profile), currentRole: "  ", tools: " Figma \n\n Jira " };
  const back = formValuesToProfile(values, profile);
  assert.equal(back.currentRole, undefined);
  assert.deepEqual(back.tools, ["Figma", "Jira"]);
  assert.deepEqual(linesToList(""), []);
});

test("invalid years or projects JSON are rejected with a readable message", () => {
  const values = profileToFormValues(profile);
  assert.throws(() => formValuesToProfile({ ...values, yearsExperience: "seven" }, profile), /Years experience must be a number/);
  assert.throws(() => formValuesToProfile({ ...values, projectsJson: "{" }, profile), /Projects JSON is invalid/);
});
