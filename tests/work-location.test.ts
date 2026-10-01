import assert from "node:assert/strict";
import test from "node:test";
import {
  assessWorkLocation,
  detectWorkMode,
  homePlacesOf,
  type WorkLocationInput,
} from "../src/modules/matching/work-location";

const serbia = { places: ["Serbia"] };

function job(over: Partial<WorkLocationInput>): WorkLocationInput {
  return { source: "linkedin", title: "Product Designer", location: null, remotePolicy: null, description: "", ...over };
}

test("work mode comes from the explicit field, then the location, then the board", () => {
  assert.equal(detectWorkMode(job({ remotePolicy: "hybrid" })), "hybrid");
  assert.equal(detectWorkMode(job({ location: "Belgrade | Hibrid" })), "hybrid");
  assert.equal(detectWorkMode(job({ location: "Remote - Europe" })), "remote");
  assert.equal(detectWorkMode(job({ remotePolicy: "onsite" })), "onsite");
  assert.equal(detectWorkMode(job({ source: "remoteok" })), "remote");
  assert.equal(detectWorkMode(job({ source: "infostud", location: "Beograd" })), "onsite", "Serbian boards default to office");
  assert.equal(detectWorkMode(job({ location: "Berlin" })), "unspecified");
  assert.equal(
    detectWorkMode(job({ location: "Berlin", description: "We are a remote-first company. This is a fully remote role." })),
    "remote",
  );
});

test("remote jobs open to Serbia are ok", () => {
  assert.equal(assessWorkLocation(job({ location: "Remote - Worldwide" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ location: "Remote, Europe" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ location: "Remote EMEA" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ location: "Remote (CET timezone)" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ location: "Remote, Serbia" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ source: "remotive", location: "Anywhere" }), serbia).home, "ok");
});

test("remote jobs tied to another country are blocked", () => {
  for (const location of ["Remote - US", "Remote, United States", "Remote (Canada)", "Remote - UK", "Remote Germany", "Remote - LATAM"]) {
    const result = assessWorkLocation(job({ location }), serbia);
    assert.equal(result.home, "blocked", location);
    assert.match(result.reason, /only/);
  }
  assert.equal(
    assessWorkLocation(job({ location: "Remote (Worldwide, US preferred)" }), serbia).home,
    "ok",
    "a worldwide marker wins over a preference",
  );
});

test("the EU is not Serbia: EU-only is flagged, not hidden", () => {
  assert.equal(assessWorkLocation(job({ location: "Remote - EU" }), serbia).home, "unclear");
  assert.equal(assessWorkLocation(job({ location: "Remote" , description: "You must be authorized to work in the EU." }), serbia).home, "unclear");
});

test("residency limits in the posting body are read", () => {
  const us = assessWorkLocation(job({ location: "Remote", description: "Candidates must be located in the United States to be considered." }), serbia);
  assert.equal(us.home, "blocked");
  const permit = assessWorkLocation(job({ location: "Remote", description: "You need to be authorized to work in the US." }), serbia);
  assert.equal(permit.home, "blocked");
  const citizens = assessWorkLocation(job({ location: "Remote", description: "US citizens only." }), serbia);
  assert.equal(citizens.home, "blocked");
  const open = assessWorkLocation(job({ location: "Remote", description: "Work from anywhere. We hire in Serbia too." }), serbia);
  assert.equal(open.home, "unclear", "no restriction and no region: unclear, not blocked");
});

test("on-site and hybrid jobs need to be in Serbia", () => {
  assert.equal(assessWorkLocation(job({ location: "Belgrade, Serbia", remotePolicy: "hybrid" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ location: "Novi Sad", remotePolicy: "onsite" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ source: "helloworld", location: "Beograd | Hibrid" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ location: "Berlin, Germany", remotePolicy: "onsite" }), serbia).home, "blocked");
  assert.equal(assessWorkLocation(job({ location: "London | Hybrid" }), serbia).home, "blocked");
  assert.equal(assessWorkLocation(job({ remotePolicy: "onsite" }), serbia).home, "unclear");
});

test("with no mode stated, the place decides", () => {
  assert.equal(assessWorkLocation(job({ location: "Belgrade" }), serbia).home, "ok");
  assert.equal(assessWorkLocation(job({ location: "Springfield" }), serbia).home, "unclear", "an unknown place is not assumed foreign");
  assert.equal(assessWorkLocation(job({ location: "Berlin" }), serbia).home, "blocked");
  assert.equal(assessWorkLocation(job({ location: null }), serbia).home, "unclear");
});

test("someone who also searches abroad keeps those places", () => {
  const places = homePlacesOf(["Serbia", "Remote", "Germany"]);
  assert.deepEqual(places, ["Serbia", "Germany"]);
  assert.equal(assessWorkLocation(job({ location: "Berlin, Germany", remotePolicy: "hybrid" }), { places }).home, "ok");
});

test("a bare city on a remote listing is the company's base, not a restriction", () => {
  const result = assessWorkLocation(job({ location: "Berlin, Germany", remotePolicy: "remote" }), serbia);
  assert.equal(result.home, "unclear");
  assert.equal(assessWorkLocation(job({ location: "Remote - Germany" }), serbia).home, "blocked");
});
