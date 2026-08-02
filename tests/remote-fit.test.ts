import assert from "node:assert/strict";
import {
  deriveRemoteFit,
  parseMatchExtrasFromScoreJson,
  resolveRemoteFit,
  splitMatchReason,
  timezoneLabel,
} from "../src/modules/matching/remote-fit";

assert.deepEqual(splitMatchReason("Stack: React, TypeScript, Cursor"), {
  label: "Stack",
  detail: "React, TypeScript, Cursor",
});

assert.deepEqual(
  splitMatchReason("Title/Experience — Senior Product Designer fit"),
  {
    label: "Title/Experience",
    detail: "Senior Product Designer fit",
  },
);

const unclear = deriveRemoteFit({
  remotePolicy: null,
  location: "Denver, CO",
  concerns: [
    "Job is in Denver, CO; remote policy not explicit.",
    "Candidate is CET; team is Mountain Time — overlap challenge.",
  ],
  eligibility: "borderline",
  remoteRequired: true,
});
assert.equal(unclear.status, "unclear");
assert.equal(unclear.policy, "unspecified");
assert.equal(unclear.timezoneOverlap, "partial");
assert.equal(timezoneLabel(unclear.timezoneOverlap), "TZ · Partial");

const pass = deriveRemoteFit({
  remotePolicy: "remote",
  location: "Remote - Worldwide",
  concerns: [],
  eligibility: "eligible",
  remoteRequired: true,
});
assert.equal(pass.status, "pass");
assert.equal(pass.policy, "remote");

const fail = deriveRemoteFit({
  remotePolicy: "onsite",
  location: "Denver, CO",
  concerns: ["Must relocate; remote ban for this role."],
  eligibility: "ineligible",
  remoteRequired: true,
});
assert.equal(fail.status, "fail");

const fromScore = parseMatchExtrasFromScoreJson(
  JSON.stringify({
    mainRisk: "Timezone overlap",
    missingRequirements: ["US work auth"],
    remoteFit: {
      status: "unclear",
      policy: "unspecified",
      geoOk: null,
      timezoneOverlap: "partial",
      summary: "Denver HQ; remote not explicit.",
      evidence: ["Location: Denver, CO"],
    },
  }),
);
assert.equal(fromScore.mainRisk, "Timezone overlap");
assert.deepEqual(fromScore.missingRequirements, ["US work auth"]);
assert.equal(fromScore.remoteFit?.status, "unclear");

const resolved = resolveRemoteFit({
  scoreJson: JSON.stringify({
    remoteFit: {
      status: "pass",
      policy: "remote",
      geoOk: true,
      timezoneOverlap: "full",
      summary: "Fully remote, EU OK.",
      evidence: ["Remote-first"],
    },
  }),
  remotePolicy: null,
  location: "Denver, CO",
  concerns: ["would have been unclear"],
  eligibility: "borderline",
  remoteRequired: true,
});
assert.equal(resolved.status, "pass");
assert.equal(resolved.summary, "Fully remote, EU OK.");

console.log("remote-fit.test.ts: ok");
