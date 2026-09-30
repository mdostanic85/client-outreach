import assert from "node:assert/strict";
import { test } from "node:test";
import { OCCUPATIONS, getOccupation } from "../src/modules/occupations/catalog";
import { OCCUPATION_FAMILIES } from "../src/modules/occupations/families";
import {
  findOccupation,
  inferFamily,
  normalizeTitle,
  occupationSearchTerms,
  resolveFamily,
  searchOccupations,
} from "../src/modules/occupations/search";
import { planSources } from "../src/modules/occupations/sources";
import { filterRawJobs } from "../src/modules/jobs/filters";
import {
  EMPTY_SEARCH_PARAMS,
  withMarketDefaults,
} from "../src/modules/search-profile/schemas";
import type { RawCollectedJob } from "../src/modules/collectors/types";

test("catalog ids are unique and every family has occupations", () => {
  const ids = OCCUPATIONS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const family of OCCUPATION_FAMILIES) {
    assert.ok(OCCUPATIONS.some((o) => o.family === family), family);
  }
});

test("normalizeTitle strips Serbian diacritics", () => {
  assert.equal(normalizeTitle("Vozač  C kategorije"), "vozac c kategorije");
  assert.equal(normalizeTitle("Računovođa"), "racunovodja");
});

test("autocomplete finds Serbian and English names", () => {
  assert.equal(searchOccupations("medicinska")[0]?.id, "nurse");
  assert.equal(searchOccupations("nurse")[0]?.id, "nurse");
  assert.equal(searchOccupations("vozac c")[0]?.id, "truck_driver");
  assert.equal(searchOccupations("truck")[0]?.id, "truck_driver");
  assert.equal(searchOccupations("racunov")[0]?.id, "accountant");
  assert.deepEqual(searchOccupations("a"), []);
});

test("findOccupation ignores level words", () => {
  assert.equal(findOccupation("Senior Product Designer")?.id, "product_designer");
  assert.equal(findOccupation("Glavni kuvar")?.id, "chef");
  assert.equal(findOccupation("Samostalni računovođa")?.id, "accountant");
  assert.equal(findOccupation("Astronaut"), null);
});

test("family is inferred for profiles saved before families existed", () => {
  assert.equal(inferFamily(["Senior Product Designer"]), "tech_digital");
  assert.equal(inferFamily([undefined, "Medicinska sestra"]), "healthcare");
  assert.equal(resolveFamily({ occupationFamily: "education", targetRoles: ["Nurse"] }), "education");
  assert.equal(resolveFamily({ targetRoles: ["Vozač kamiona"] }), "transport_logistics");
  assert.equal(resolveFamily({ targetRoles: ["Astronaut"] }), null);
});

test("search terms include both languages without duplicates", () => {
  const terms = occupationSearchTerms(getOccupation("truck_driver")!);
  assert.equal(terms[0], "Truck Driver");
  assert.ok(terms.includes("Vozač kamiona"));
  assert.ok(terms.includes("Vozač CE kategorije"));
  const pilot = occupationSearchTerms(getOccupation("pilot")!);
  assert.equal(pilot.filter((t) => t === "Pilot").length, 1);
});

test("sources follow family and location", () => {
  const nurse = planSources({ family: "healthcare", locations: ["Beograd"], remoteAllowed: false });
  assert.deepEqual(nurse.sourcesEnabled.sort(), ["infostud", "linkedin"]);
  assert.deepEqual(nurse.atsBoardUrls, []);

  const dev = planSources({ family: "tech_digital", locations: ["Serbia", "Remote"], remoteAllowed: true });
  for (const s of ["infostud", "linkedin", "helloworld", "remotive", "arbeitnow", "greenhouse"]) {
    assert.ok(dev.sourcesEnabled.includes(s as never), s);
  }
  assert.ok(dev.atsBoardUrls.length > 0);

  // Remote isn't offered to a family where it's rare, even if asked.
  const driver = planSources({ family: "transport_logistics", locations: ["Remote"], remoteAllowed: true });
  assert.ok(!driver.sourcesEnabled.includes("remotive"));
  assert.ok(driver.sourcesEnabled.includes("infostud"));

  const euNurse = planSources({ family: "healthcare", locations: ["Germany"], remoteAllowed: false });
  assert.deepEqual(euNurse.sourcesEnabled.sort(), ["arbeitnow", "linkedin"]);
});

test("withMarketDefaults sets synonyms and sources without forcing remote", () => {
  const params = withMarketDefaults(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Truck Driver"], locations: [] },
    { family: "transport_logistics", occupationId: "truck_driver", synonyms: ["Vozač kamiona", "Vozač C kategorije"] },
  );
  assert.deepEqual(params.locations, ["Serbia"]);
  assert.equal(params.remoteRequired, false);
  assert.equal(params.occupationFamily, "transport_logistics");
  assert.ok(params.titleSynonyms.includes("Vozač C kategorije"));
  assert.ok(!params.sourcesEnabled.includes("remotive"));
});

function job(title: string, extra: Partial<RawCollectedJob> = {}): RawCollectedJob {
  return {
    source: "infostud",
    externalId: title,
    title,
    companyName: "Firma",
    location: "Beograd",
    description: "",
    sourceUrl: `https://example.com/${encodeURIComponent(title)}`,
    postedAt: new Date().toISOString(),
    ...extra,
  };
}

test("title filter matches Serbian synonyms and ignores accents", () => {
  const params = withMarketDefaults(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Truck Driver"] },
    { family: "transport_logistics", occupationId: "truck_driver", synonyms: ["Vozač kamiona", "Vozač C kategorije", "Vozač CE kategorije"] },
  );
  const { kept, dropped } = filterRawJobs(
    [
      job("Vozač C kategorije - međunarodni transport"),
      job("VOZAC CE KATEGORIJE"),
      job("Vozač kamiona"),
      job("Računovođa"),
    ],
    params,
  );
  assert.deepEqual(kept.map((j) => j.title), ["Vozač C kategorije - međunarodni transport", "VOZAC CE KATEGORIJE", "Vozač kamiona"]);
  assert.equal(dropped[0]?.reason, "unrelated_title");
});

test("on-site searches keep on-site jobs; acronyms don't match inside words", () => {
  const params = withMarketDefaults(
    { ...EMPTY_SEARCH_PARAMS, targetTitles: ["UX Designer"] },
    { family: "tech_digital", synonyms: [] },
  );
  const { kept } = filterRawJobs(
    [job("UX Designer", { remotePolicy: "on-site" }), job("Build Engineer")],
    params,
  );
  assert.deepEqual(kept.map((j) => j.title), ["UX Designer"]);
});
