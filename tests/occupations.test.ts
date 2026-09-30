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
