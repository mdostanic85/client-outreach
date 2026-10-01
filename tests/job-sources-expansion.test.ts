import assert from "node:assert/strict";
import { test } from "node:test";
import { arbeitnowTitleAllowed } from "../src/modules/discovery/arbeitnow";
import { fetchAtsBoard, normalizeAtsPayload, parseAtsBoard } from "../src/modules/collectors/direct-ats";
import { expandFreeQueries, expandRegionalQueries } from "../src/modules/collectors/run";
import { infostudSearchUrl } from "../src/modules/collectors/infostud";
import { parseJobertyList } from "../src/modules/collectors/joberty";
import { parseNszListing } from "../src/modules/collectors/nsz";
import { collectPoslovi, parsePosloviListing } from "../src/modules/collectors/poslovi";
import { remotiveSearchUrl } from "../src/modules/collectors/remotive";
import { serbiaSearchPlaces } from "../src/modules/collectors/serbia-places";
import { FAMILY_PROFILES } from "../src/modules/occupations/families";
import { planSources } from "../src/modules/occupations/sources";
import { EMPTY_SEARCH_PARAMS } from "../src/modules/search-profile/schemas";

test("Remotive uses the family category and does not default to design", () => {
  const plain = new URL(remotiveSearchUrl("Registered Nurse"));
  assert.equal(plain.searchParams.get("category"), null);
  assert.equal(plain.searchParams.get("search"), "Registered Nurse");
  assert.equal(new URL(remotiveSearchUrl("Engineer", "software-dev")).searchParams.get("category"), "software-dev");

  const healthcare = expandFreeQueries({
    ...EMPTY_SEARCH_PARAMS,
    occupationFamily: "healthcare",
    targetTitles: ["Nurse"],
    sourcesEnabled: ["remotive", "arbeitnow"],
  });
  assert.ok(healthcare.every((query) => query.source !== "remotive"));
  assert.ok(healthcare.some((query) => query.source === "arbeitnow"));

  const tech = expandFreeQueries({
    ...EMPTY_SEARCH_PARAMS,
    occupationFamily: "tech_digital",
    targetTitles: ["Software Engineer"],
    locations: ["Remote"],
    sourcesEnabled: ["remotive"],
  });
  assert.deepEqual(
    tech.map((query) => query.remotiveCategory).sort(),
    [...FAMILY_PROFILES.tech_digital.remotiveCategories].sort(),
  );
});

test("Arbeitnow keeps a nurse when the occupation says so", () => {
  assert.equal(arbeitnowTitleAllowed("Medicinska sestra", ["Nurse", "Medicinska sestra"]), true);
  assert.equal(arbeitnowTitleAllowed("UX Designer", ["Nurse", "Medicinska sestra"]), false);
  assert.equal(arbeitnowTitleAllowed("Medicinska sestra", undefined), true);
});

test("Serbia without a city searches Belgrade, Novi Sad and Niš", () => {
  assert.deepEqual(serbiaSearchPlaces(["Serbia"]).map((place) => place.label), ["Beograd", "Novi Sad", "Niš"]);
  assert.deepEqual(serbiaSearchPlaces(["Belgrade"]).map((place) => place.label), ["Beograd"]);
  assert.match(infostudSearchUrl("sestra", 1, "35"), /cities\[\]=35/);
  assert.equal(infostudSearchUrl("sestra", 1).includes("cities"), false);

  const named = expandRegionalQueries({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: ["Nurse"],
    locations: ["Niš"],
    sourcesEnabled: ["infostud", "helloworld"],
  });
  assert.deepEqual(named.filter((query) => query.source === "infostud").map((query) => query.cityId), ["96"]);
  assert.equal(named.filter((query) => query.source === "helloworld").length, 1);
});

test("Serbia healthcare is Infostud, Poslovi, NSZ and LinkedIn, without remote boards or ATS", () => {
  const nurse = planSources({ family: "healthcare", locations: ["Serbia"], remoteAllowed: false });
  assert.deepEqual(nurse.sourcesEnabled.sort(), ["infostud", "linkedin", "nsz", "poslovi"]);
  assert.deepEqual(nurse.atsBoardUrls, []);

  const dev = planSources({ family: "tech_digital", locations: ["Serbia"], remoteAllowed: false });
  assert.ok(dev.sourcesEnabled.includes("joberty"));
  assert.ok(dev.sourcesEnabled.includes("helloworld"));
  // Remote boards are read even when remote was not asked for; the list filters by work mode.
  assert.ok(dev.sourcesEnabled.includes("remotive"));
  assert.ok(dev.sourcesEnabled.includes("himalayas"));
  assert.ok(dev.atsBoardUrls.some((url) => url.includes("teamtailor.com")));
});

const posloviList = `<a class="item-block" href="/job/pu-sinderela/medicinska-sestra-mz-238220">
  <h4 class="ellipsis-box">Medicinska sestra (m/ž)</h4>
  <h5 class="epl_name_list">PU Sinderela<span class="epl_company_list"></span></h5>
  <span class="status" title="Beograd">Beograd</span>
</a>
<a class="item-block" href="https://evil.test/job/x/y-1"><h4>Nope</h4></a>`;

test("Poslovi.rs keeps on-site cards and ignores foreign links", () => {
  const cards = parsePosloviListing(posloviList);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.id, "238220");
  assert.equal(cards[0]!.companyName, "PU Sinderela");
  assert.equal(cards[0]!.sourceUrl, "https://www.poslovi.rs/job/pu-sinderela/medicinska-sestra-mz-238220");
  assert.equal(cards[0]!.location, "Beograd");
});

test("Poslovi.rs stops when the board returns 429", async () => {
  const fetcher: typeof fetch = async () => new Response("", { status: 429 });
  await assert.rejects(
    collectPoslovi(
      { title: "Nurse", location: "Beograd", postedWithinHours: 48, maxResults: 5, source: "poslovi", cityId: "10" },
      { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Nurse"] },
      { fetcher, sleep: async () => {} },
    ),
    /poslovi blocked/,
  );
});

const nszList = `<div class="single-job"><div onclick="document.location.href='https://www.nsz.gov.rs/employee/jobs/preview/103644'">
  <h3 class="job-title">Medicinska sestra - Vaspitač</h3>
  <p class="job-description">PPU Kućica Maštalica  Beograd</p>
</div></div>`;

test("NSZ reads the preview id, title and city", () => {
  const cards = parseNszListing(nszList);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.id, "103644");
  assert.equal(cards[0]!.title, "Medicinska sestra - Vaspitač");
  assert.equal(cards[0]!.location, "Beograd");
  assert.equal(cards[0]!.companyName, "PPU Kućica Maštalica");
  assert.equal(cards[0]!.sourceUrl, "https://www.nsz.gov.rs/employee/jobs/preview/103644");
});

test("Joberty maps the public list and ignores a logo blob", () => {
  const parsed = parseJobertyList({
    totalPage: 1,
    items: [{
      id: 15,
      jobTitle: "Backend Developer",
      companyName: "Studio",
      companyUrlName: "studio",
      cities: ["Novi Sad (Serbia)"],
      website: "https://studio.example",
      logo: "a".repeat(5000),
    }, { id: "x", jobTitle: "Broken" }],
  });
  assert.equal(parsed.cards.length, 1);
  assert.equal(parsed.cards[0]!.companyDomain, "studio.example");
  assert.equal(parsed.cards[0]!.sourceUrl, "https://www.joberty.com/studio/backend-developer/15");
  assert.equal(parseJobertyList({ items: [] }).last, true);
});

test("new ATS hosts are pinned and empty or partial payloads stay usable", () => {
  assert.match(parseAtsBoard("https://sokin.teamtailor.com/jobs").endpoint, /^https:\/\/sokin\.teamtailor\.com\/jobs\.json$/);
  assert.match(parseAtsBoard("https://apply.workable.com/nordeus").endpoint, /widget\/accounts\/nordeus$/);
  assert.match(parseAtsBoard("https://acme.recruitee.com").endpoint, /^https:\/\/acme\.recruitee\.com\/api\/offers\/$/);
  assert.match(parseAtsBoard("https://jobs.smartrecruiters.com/Acme").endpoint, /companies\/Acme\/postings$/);
  assert.match(parseAtsBoard("https://acme.jobs.personio.de/xml").endpoint, /^https:\/\/acme\.jobs\.personio\.de\/xml$/);
  for (const url of [
    "https://evil.teamtailor.com.evil.test/jobs",
    "https://www.teamtailor.com/jobs",
    "https://sokin.teamtailor.com/jobs/123-role",
    "https://apply.workable.com/acme/j/ABC",
    "http://sokin.teamtailor.com/jobs",
    "https://jobs.smartrecruiters.com/Acme/123",
  ]) {
    assert.throws(() => parseAtsBoard(url), url);
  }

  const teamtailor = parseAtsBoard("https://sokin.teamtailor.com/jobs");
  assert.deepEqual(normalizeAtsPayload(teamtailor, { title: "Sokin", items: [] }), []);
  const jobs = normalizeAtsPayload(teamtailor, {
    title: "Sokin",
    items: [
      { id: "1", title: "Nurse", url: "https://evil.test/job" },
      { id: "2", title: "Marketing Manager", url: "https://sokin.teamtailor.com/jobs/2-marketing", content_html: "<p>Ads</p>", date_published: "2026-09-30T09:22:04+01:00" },
    ],
  });
  assert.deepEqual(jobs.map((job) => job.title), ["Marketing Manager"]);
  assert.equal(jobs[0]!.description, "Ads");

  const personio = parseAtsBoard("https://bank.jobs.personio.com/xml");
  const xml = `<?xml version="1.0"?><workzag-jobs><position><id>9</id><name>Accountant</name><office>Beograd</office><jobDescriptions><jobDescription><value><![CDATA[<p>Ledger</p>]]></value></jobDescription></jobDescriptions></position></workzag-jobs>`;
  const accounting = normalizeAtsPayload(personio, xml);
  assert.equal(accounting[0]?.title, "Accountant");
  assert.equal(accounting[0]?.location, "Beograd");
  assert.match(accounting[0]?.description ?? "", /Ledger/);
  assert.throws(() => normalizeAtsPayload(personio, { jobs: [] }));
});

test("one blocked ATS board does not stop the next board", async () => {
  const blocked = parseAtsBoard("https://apply.workable.com/acme");
  const open = parseAtsBoard("https://acme.recruitee.com");
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("workable")) return new Response("", { status: 429, headers: { "retry-after": "90" } });
    return Response.json({ offers: [{ id: 1, title: "Backend Developer", careers_url: "https://acme.recruitee.com/o/backend", description: "<p>API</p>", company_name: "Acme" }] });
  };
  const found = [];
  const errors: string[] = [];
  for (const board of [blocked, open]) {
    try {
      found.push(...await fetchAtsBoard(board, fetcher));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /workable/);
  assert.equal(found[0]?.title, "Backend Developer");
});
