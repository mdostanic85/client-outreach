import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_SEARCH_PARAMS, normalizeCollectorParams, type JobSearchParams } from "../src/modules/search-profile/schemas";
import { isoDate, SourceBlockedError, walkListing } from "../src/modules/collectors/polite-fetch";
import { collectLinkedIn, linkedInSearchUrl, parseLinkedInPosting, parseLinkedInSearch } from "../src/modules/collectors/linkedin";
import { collectHelloWorld, helloWorldSearchUrl, helloWorldWorkplace, parseHelloWorldListing, parseHelloWorldPosting } from "../src/modules/collectors/helloworld";
import { collectInfostud, parseInfostudPosting, parseInfostudSearch } from "../src/modules/collectors/infostud";
import { regionalSearchTerms } from "../src/modules/collectors/run";
import type { CollectorQuery } from "../src/modules/collectors/types";

const params: JobSearchParams = normalizeCollectorParams({ ...EMPTY_SEARCH_PARAMS, targetTitles: ["Senior Product Designer"], locations: ["Remote"], postedWithinHours: 720, remoteRequired: true, remotePolicy: "remote_ok_required" });
const hybridOk: JobSearchParams = { ...params, remoteRequired: false, remotePolicy: "any" };
const noSleep = async () => {};
const query = (source: CollectorQuery["source"], extra: Partial<CollectorQuery> = {}): CollectorQuery =>
  ({ title: "Senior Product Designer", location: "Remote", postedWithinHours: 48, maxResults: 10, source, ...extra });

/** Fake fetch keyed by URL substring; records every requested URL. */
function fakeFetch(routes: Array<[string, () => Response]>) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    assert.equal(init?.redirect, "manual");
    const route = routes.find(([needle]) => url.includes(needle));
    return route ? route[1]() : new Response("", { status: 404 });
  };
  return { fetcher, calls };
}
const html = (body: string) => () => new Response(body, { status: 200 });

const liCard = (id: string, title: string) => `<li><div class="base-card" data-entity-urn="urn:li:jobPosting:${id}">
  <h3 class="base-search-card__title"> ${title} </h3><h4 class="base-search-card__subtitle"><a> Acme </a></h4>
  <span class="job-search-card__location"> Berlin, Germany </span><time datetime="2026-09-28"></time></div></li>`;
const liPosting = `<div class="show-more-less-html__markup"><p>Own the <strong>design system</strong>.</p><ul><li>Figma</li></ul></div>
  <ul><li class="description__job-criteria-item"><h3 class="description__job-criteria-subheader">Employment type</h3><span class="description__job-criteria-text"> Full-time </span></li></ul>`;

test("LinkedIn guest search URL applies time window and remote filter", () => {
  const url = new URL(linkedInSearchUrl(query("linkedin"), true, 20));
  assert.equal(url.searchParams.get("f_TPR"), "r172800");
  assert.equal(url.searchParams.get("f_WT"), "2");
  assert.equal(url.searchParams.get("start"), "20");
  assert.equal(new URL(linkedInSearchUrl(query("linkedin"), false, 0)).searchParams.has("f_WT"), false);
});

test("LinkedIn parser keeps numeric IDs and skips malformed cards", () => {
  const cards = parseLinkedInSearch(liCard("123", "Senior Product Designer") + `<div data-entity-urn="urn:li:jobPosting:abc"></div>`);
  assert.deepEqual(cards, [{ id: "123", title: "Senior Product Designer", companyName: "Acme", location: "Berlin, Germany", postedAt: "2026-09-28T00:00:00.000Z" }]);
  const detail = parseLinkedInPosting(liPosting);
  assert.equal(detail.description, "Own the design system. Figma");
  assert.equal(detail.employmentType, "Full-time");
});

test("LinkedIn fetches details only for filtered cards and stores canonical URLs", async () => {
  const { fetcher, calls } = fakeFetch([
    ["seeMoreJobPostings", html(liCard("1", "Senior Product Designer") + liCard("2", "Backend Engineer"))],
    ["jobPosting/1", html(liPosting)],
  ]);
  const result = await collectLinkedIn(query("linkedin"), params, { fetcher, sleep: noSleep });
  assert.equal(result.blocked, false);
  assert.deepEqual(result.jobs.map(j => [j.externalId, j.sourceUrl, j.remotePolicy]), [["1", "https://www.linkedin.com/jobs/view/1", "remote"]]);
  assert.equal(calls.filter(c => c.includes("jobPosting/")).length, 1, "no detail request for the unrelated title");
});

test("LinkedIn stops on rate limit or auth-wall redirect and reports blocked", async () => {
  const limited = fakeFetch([
    ["seeMoreJobPostings", html(liCard("1", "Senior Product Designer") + liCard("2", "Lead Product Designer"))],
    ["jobPosting/1", html(liPosting)],
    ["jobPosting/2", () => new Response("", { status: 429 })],
  ]);
  const partial = await collectLinkedIn(query("linkedin"), params, { fetcher: limited.fetcher, sleep: noSleep });
  assert.equal(partial.blocked, true);
  assert.equal(partial.jobs.length, 1);

  const walled = fakeFetch([["seeMoreJobPostings", () => new Response("", { status: 302, headers: { location: "/authwall" } })]]);
  await assert.rejects(collectLinkedIn(query("linkedin"), params, { fetcher: walled.fetcher, sleep: noSleep }), SourceBlockedError);
});

const hwCard = (id: string, title: string, place: string, href = `/posao/${title.replace(/\W+/g, "-")}/Acme/${id}?q=x&item_index=0`) =>
  `<div class="relative bg-white shadow-md"><h3><a data-job-id="${id}" href="${href}">${title}</a></h3><h4><a>Acme d.o.o.</a></h4>
   <div><i class="las la-map-marker"></i><p class="text-sm">${place}</p></div></div>`;
const hwPosting = `<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-09-25","employmentType":"FULL_TIME","description":"stub"}</script>
  <div class="prose __job-text-body ogl__text"><p>Radimo na B2B SaaS proizvodu.</p></div>`;

test("HelloWorld maps workplace labels without guessing", () => {
  assert.deepEqual(helloWorldWorkplace("Beograd | Hibrid"), { location: "Beograd", remotePolicy: "hybrid" });
  assert.deepEqual(helloWorldWorkplace("Rad od kuće"), { location: "Rad od kuće", remotePolicy: "remote" });
  assert.deepEqual(helloWorldWorkplace("Novi Sad"), { location: "Novi Sad", remotePolicy: "onsite" });
  assert.deepEqual(helloWorldWorkplace(""), {});
  assert.match(helloWorldSearchUrl("UX", 2), /\/oglasi-za-posao\/stranica\/60\?q=UX$/);
});

test("HelloWorld parser strips tracking params and rejects foreign links", () => {
  const cards = parseHelloWorldListing(hwCard("1", "UX/UI dizajner", "Novi Sad | Hibrid") + hwCard("2", "Designer", "Beograd", "https://evil.test/posao/a/b/2"));
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.sourceUrl, "https://www.helloworld.rs/posao/UX-UI-dizajner/Acme/1");
  const detail = parseHelloWorldPosting(hwPosting);
  assert.equal(detail.description, "Radimo na B2B SaaS proizvodu.");
  assert.equal(detail.postedAt, "2026-09-25T00:00:00.000Z");
});

test("HelloWorld merges search terms, dedupes cards and applies remote rules before details", async () => {
  const { fetcher, calls } = fakeFetch([
    ["q=UX", html(hwCard("1", "UX/UI dizajner", "Novi Sad | Hibrid") + hwCard("3", "Senior Product Designer", "Rad od kuće"))],
    ["q=dizajner", html(hwCard("1", "UX/UI dizajner", "Novi Sad | Hibrid") + hwCard("4", "Grafički dizajner", "Beograd"))],
    ["/posao/", html(hwPosting)],
  ]);
  const remoteOnly = await collectHelloWorld(query("helloworld", { searchTerms: ["UX", "dizajner"] }), params, { fetcher, sleep: noSleep });
  assert.deepEqual(remoteOnly.map(j => j.externalId), ["3"]);
  assert.equal(calls.filter(c => c.includes("/posao/")).length, 1);
  const withHybrid = await collectHelloWorld(query("helloworld", { searchTerms: ["UX"] }), hybridOk, { fetcher, sleep: noSleep });
  assert.deepEqual(withHybrid.map(j => j.externalId).sort(), ["1", "3"]);
});

const isPage = (jobs: unknown[], total: number) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialSearchResults: { totalPrimaryItems: total, jobs: { primary: jobs } } } } })}</script>`;
const isJob = (id: number, title: string, extra: Record<string, unknown> = {}) =>
  ({ id, title, companyName: "Navigator d.o.o.", location: "Novi Sad | Hibrid", url: `https://poslovi.infostud.com/posao/${id}-slug/navigator/${id}`, workFromHome: false, hybridWork: true, onlineViewDate: "25.09.2026", ...extra });
const isPosting = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { job: {
  textAd: "<h3>O poziciji</h3><p>Figma &amp; dizajn sistemi</p>", datePosted: "2026-09-25",
  employmentType: { nameSr: "ugovor na neodređeno" }, salary: null,
  unformattedSalary: { from: 2000, to: 3000, currency: "EUR", type: "net", additional: "monthly" } } } } })}</script>`;

test("Infostud reads explicit workplace booleans, dates and salary from embedded JSON", () => {
  const { cards, total } = parseInfostudSearch(isPage([
    isJob(1, "UX/UI dizajner"),
    isJob(2, "Product Designer", { workFromHome: true, hybridWork: false }),
    isJob(3, "Product Designer", { url: "https://evil.test/posao/x/y/3" }),
  ], 3));
  assert.equal(total, 3);
  assert.deepEqual(cards.map(c => [c.id, c.remotePolicy, c.location]), [["1", "hybrid", "Novi Sad"], ["2", "remote", "Novi Sad"]]);
  assert.equal(cards[0]!.postedAt, "2026-09-25T00:00:00.000Z");
  const detail = parseInfostudPosting(isPosting);
  assert.equal(detail.description, "O poziciji Figma & dizajn sistemi");
  assert.equal(detail.salaryText, "2000–3000 EUR net monthly");
  assert.equal(detail.employmentType, "ugovor na neodređeno");
  assert.throws(() => parseInfostudSearch("<html></html>"), /__NEXT_DATA__/);
});

test("Infostud pagination stops at the reported total", async () => {
  const { fetcher, calls } = fakeFetch([
    ["oglasi-za-posao", html(isPage([isJob(1, "UX/UI dizajner")], 1))],
    ["/posao/", html(isPosting)],
  ]);
  const jobs = await collectInfostud(query("infostud"), hybridOk, { fetcher, sleep: noSleep });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.salaryText, "2000–3000 EUR net monthly");
  assert.equal(calls.filter(c => c.includes("oglasi-za-posao")).length, 1);
});

test("walkListing keeps earlier cards on a later block and caps requests", async () => {
  let n = 0;
  const partial = await walkListing({
    terms: ["a", "b"], maxPages: 5, maxRequests: 10, delayMs: [0, 0], sleep: noSleep,
    loadPage: async () => { if (n++ === 1) throw new SourceBlockedError("x", 429); return { cards: [{ id: String(n) }], last: false }; },
  });
  assert.deepEqual([...partial.cards.keys()], ["1"]);
  assert.equal(partial.blocked, true);
  let requests = 0;
  await walkListing({
    terms: ["a", "b"], maxPages: 5, maxRequests: 3, delayMs: [0, 0], sleep: noSleep,
    loadPage: async () => ({ cards: [{ id: String(++requests) }], last: false }),
  });
  assert.equal(requests, 3);
});

test("Regional terms include the core title, the Serbian name and synonyms", () => {
  assert.deepEqual(
    regionalSearchTerms({ ...params, targetTitles: ["Senior Product Designer", "Staff Product Designer"], occupationId: "product_designer", titleSynonyms: ["UX Designer", "UI/UX dizajner"] }),
    ["Senior Product Designer", "Product Designer", "Product dizajner", "UX Designer", "UI/UX dizajner", "Staff Product Designer"]);
  assert.deepEqual(regionalSearchTerms({ ...params, targetTitles: ["Senior Data Engineer"], occupationId: undefined, titleSynonyms: [] }), ["Senior Data Engineer", "Data Engineer"]);
  assert.deepEqual(
    regionalSearchTerms({ ...params, targetTitles: ["Truck Driver"], occupationId: "truck_driver", titleSynonyms: ["Vozač C kategorije"] }),
    ["Truck Driver", "Vozač kamiona", "Vozač C kategorije"]);
  assert.equal(isoDate("06.10.2026."), "2026-10-06T00:00:00.000Z");
  assert.equal(isoDate("not a date"), undefined);
});
