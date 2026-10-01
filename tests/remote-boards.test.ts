import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectHimalayas,
  collectJobicy,
  collectRemoteOk,
  collectWeWorkRemotely,
  collectWorkingNomads,
  parseHimalayas,
  parseJobicy,
  parseRemoteOk,
  parseWeWorkRemotely,
  parseWorkingNomads,
  weWorkRemotelyFeeds,
} from "../src/modules/collectors/remote-feeds";
import { expandFreeQueries, FREE_BOARD_SHARE } from "../src/modules/collectors/run";
import { REMOTE_BOARD_SOURCES, planSources } from "../src/modules/occupations/sources";
import { assessWorkLocation } from "../src/modules/matching/work-location";
import { EMPTY_SEARCH_PARAMS, normalizeCollectorParams } from "../src/modules/search-profile/schemas";
import type { CollectorQuery } from "../src/modules/collectors/types";

const query = (source: CollectorQuery["source"], extra: Partial<CollectorQuery> = {}): CollectorQuery => ({
  title: "Product Designer",
  location: "Remote",
  postedWithinHours: 720,
  maxResults: 10,
  source,
  ...extra,
});

function fakeFetch(routes: Array<[string, () => Response]>) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    const route = routes.find(([needle]) => url.includes(needle));
    return route ? route[1]() : new Response("", { status: 404 });
  };
  return { fetcher, calls };
}
const json = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 });

const home = { places: ["Serbia"] };

test("Remote OK: skips the legal notice and maps jobs", async () => {
  const payload = [
    { legal: "https://remoteok.com/legal" },
    { id: "1001", slug: "remote-product-designer-acme-1001", date: "2026-09-28T10:00:00+00:00", company: "Acme", position: "Product Designer", tags: ["design", "figma"], description: "<p>Design <b>things</b>.</p>", location: "Worldwide", salary_min: 80000, salary_max: 120000, url: "https://remoteok.com/remote-jobs/remote-product-designer-acme-1001" },
    { id: "1002", company: "Backend Co", position: "Rust Engineer", description: "<p>Rust</p>", location: "US only", url: "https://remoteok.com/remote-jobs/rust-1002" },
  ];
  const parsed = parseRemoteOk(payload);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]!.source, "remoteok");
  assert.equal(parsed[0]!.remotePolicy, "remote");
  assert.equal(parsed[0]!.location, "Remote - Worldwide");
  assert.match(parsed[0]!.salaryText ?? "", /80,000–120,000 USD/);
  assert.match(parsed[0]!.description, /Design things/);

  const { fetcher } = fakeFetch([["remoteok.com/api", json(payload)]]);
  const jobs = await collectRemoteOk(query("remoteok"), { fetcher });
  assert.deepEqual(jobs.map((j) => j.title), ["Product Designer"]);
  assert.equal(assessWorkLocation(jobs[0]!, home).home, "ok");
  assert.equal(assessWorkLocation(parsed[1]!, home).home, "blocked");
});

test("Remote OK: an unexpected payload fails the source", () => {
  assert.throws(() => parseRemoteOk({ error: "nope" }), /unexpected payload/);
});

test("Himalayas: location restrictions decide access", async () => {
  const worldwide = { guid: "h1", title: "Senior Product Designer", companyName: "Globex", description: "<p>Design</p>", locationRestrictions: [], employmentType: "Full Time", minSalary: 60000, maxSalary: 90000, currency: "EUR", pubDate: 1790000000, applicationLink: "https://himalayas.app/companies/globex/jobs/h1" };
  const usOnly = { ...worldwide, guid: "h2", locationRestrictions: ["United States"], applicationLink: "https://himalayas.app/companies/globex/jobs/h2" };
  const europe = { ...worldwide, guid: "h3", locationRestrictions: ["Serbia", "Germany"], applicationLink: "https://himalayas.app/companies/globex/jobs/h3" };
  const parsed = parseHimalayas({ jobs: [worldwide, usOnly, europe] });
  assert.deepEqual(parsed.map((j) => assessWorkLocation(j, home).home), ["ok", "blocked", "ok"]);
  assert.equal(parsed[0]!.employmentType, "Full Time");
  assert.match(parsed[0]!.salaryText ?? "", /EUR/);
  assert.ok(parsed[0]!.postedAt);

  const { fetcher, calls } = fakeFetch([["himalayas.app/jobs/api/search", json({ jobs: [worldwide] })]]);
  const jobs = await collectHimalayas(query("himalayas", { searchTerms: ["UX Designer"] }), { fetcher });
  assert.equal(jobs.length, 1);
  assert.ok(calls.some((url) => url.includes("q=Product+Designer")));
  assert.ok(calls.some((url) => url.includes("q=UX+Designer")));
});

test("Jobicy: jobGeo becomes the remote region", async () => {
  const payload = { jobs: [
    { id: 7, url: "https://jobicy.com/jobs/7-designer", jobTitle: "Product Designer", companyName: "Initech", jobGeo: "Anywhere", jobType: ["Full-Time"], jobDescription: "<p>Lead design.</p>", pubDate: "2026-09-27 08:30:00", annualSalaryMin: 50000, annualSalaryMax: 70000, salaryCurrency: "EUR" },
    { id: 8, url: "https://jobicy.com/jobs/8-designer", jobTitle: "Product Designer", companyName: "Umbrella", jobGeo: "USA", jobType: ["Full-Time"], jobDescription: "<p>US team.</p>", pubDate: "2026-09-27 08:30:00" },
  ] };
  const parsed = parseJobicy(payload);
  assert.equal(parsed[0]!.location, "Remote - Anywhere");
  assert.equal(parsed[0]!.postedAt, "2026-09-27T08:30:00.000Z");
  assert.equal(parsed[0]!.employmentType, "Full-Time");
  assert.deepEqual(parsed.map((j) => assessWorkLocation(j, home).home), ["ok", "blocked"]);
  const { fetcher } = fakeFetch([["jobicy.com/api/v2/remote-jobs", json(payload)]]);
  assert.equal((await collectJobicy(query("jobicy"), { fetcher })).length, 2);
});

const wwrRss = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Acme: Product Designer</title><region>Anywhere in the World</region><type>Full-Time</type><pubDate>Mon, 28 Sep 2026 10:00:00 +0000</pubDate>
<link>https://weworkremotely.com/remote-jobs/acme-product-designer</link><guid>https://weworkremotely.com/remote-jobs/acme-product-designer</guid>
<description><![CDATA[<p>Design for <a href="https://acme.io">Acme</a>.</p>]]></description></item>
<item><title>Foo: Salesforce Admin</title><region>USA Only</region><link>https://weworkremotely.com/remote-jobs/foo-admin</link><guid>https://weworkremotely.com/remote-jobs/foo-admin</guid><description><![CDATA[<p>Admin</p>]]></description></item>
</channel></rss>`;

test("We Work Remotely: RSS items split company and role", async () => {
  const parsed = parseWeWorkRemotely(wwrRss);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]!.companyName, "Acme");
  assert.equal(parsed[0]!.title, "Product Designer");
  assert.equal(parsed[0]!.location, "Remote - Anywhere in the World");
  assert.equal(parsed[0]!.companyDomain, "acme.io");
  assert.equal(assessWorkLocation(parsed[1]!, home).home, "blocked");

  const { fetcher, calls } = fakeFetch([["weworkremotely.com", () => new Response(wwrRss, { status: 200 })]]);
  const jobs = await collectWeWorkRemotely(query("weworkremotely", { family: "tech_digital" }), { fetcher });
  assert.deepEqual(jobs.map((j) => j.title), ["Product Designer"]);
  assert.ok(calls.some((url) => url.endsWith("/categories/remote-design-jobs.rss")));
  assert.equal(new Set(jobs.map((j) => j.externalId)).size, jobs.length);
});

test("We Work Remotely: one dead category feed does not lose the rest", async () => {
  const { fetcher } = fakeFetch([
    ["categories/remote-design-jobs", () => new Response("", { status: 500 })],
    ["weworkremotely.com", () => new Response(wwrRss, { status: 200 })],
  ]);
  const jobs = await collectWeWorkRemotely(query("weworkremotely", { family: "tech_digital" }), { fetcher });
  assert.equal(jobs.length, 1);
  assert.deepEqual(weWorkRemotelyFeeds(undefined), ["https://weworkremotely.com/remote-jobs.rss"]);
});

test("Working Nomads: tags join the description and expired postings drop", async () => {
  const payload = [
    { url: "https://www.workingnomads.com/jobs/designer-1", title: "Product Designer", company_name: "Hooli", description: "<p>Design</p>", tags: "design,figma", location: "Europe", pub_date: "2026-09-26T09:00:00-04:00" },
    { url: "https://www.workingnomads.com/jobs/designer-2", title: "Product Designer", company_name: "Pied Piper", description: "<p>Old</p>", expired: true },
  ];
  const parsed = parseWorkingNomads(payload);
  assert.equal(parsed.length, 1);
  assert.match(parsed[0]!.description, /Tags: design, figma/);
  assert.equal(assessWorkLocation(parsed[0]!, home).home, "ok");
  const { fetcher } = fakeFetch([["workingnomads.com/api/exposed_jobs", json(payload)]]);
  assert.equal((await collectWorkingNomads(query("workingnomads"), { fetcher })).length, 1);
});

test("a feed that answers with an error fails that source only", async () => {
  const { fetcher } = fakeFetch([["remoteok.com", () => new Response("", { status: 503 })]]);
  await assert.rejects(collectRemoteOk(query("remoteok"), { fetcher }), /HTTP 503/);
});

test("remote boards are planned for families where remote work is common, remote asked or not", () => {
  const dev = planSources({ family: "tech_digital", locations: ["Serbia"], remoteAllowed: false });
  for (const source of REMOTE_BOARD_SOURCES) assert.ok(dev.sourcesEnabled.includes(source), source);
  const nurse = planSources({ family: "healthcare", locations: ["Serbia"], remoteAllowed: false });
  for (const source of ["remoteok", "himalayas", "jobicy", "weworkremotely", "workingnomads"] as const) {
    assert.ok(!nurse.sourcesEnabled.includes(source), source);
  }
});

test("saved criteria gain the remote boards and the larger limits on read", () => {
  const saved = normalizeCollectorParams({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: ["Product Designer"],
    occupationFamily: "tech_digital",
    sourcesEnabled: ["infostud", "linkedin"],
    maxDailyRawJobs: 80,
    maxResultsPerQuery: 12,
  });
  for (const source of ["remoteok", "himalayas", "jobicy", "weworkremotely", "workingnomads"] as const) {
    assert.ok(saved.sourcesEnabled.includes(source), source);
  }
  assert.ok(saved.sourcesEnabled.includes("infostud"));
  assert.equal(saved.maxDailyRawJobs, 200);
  assert.equal(saved.maxResultsPerQuery, 25);
});

test("each feed board gets one query, and together they stay within the free share", () => {
  const params = normalizeCollectorParams({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: ["Product Designer", "UX Designer"],
    occupationFamily: "tech_digital",
    sourcesEnabled: ["remoteok", "himalayas", "jobicy", "weworkremotely", "workingnomads"],
  });
  const queries = expandFreeQueries(params);
  for (const source of ["remoteok", "himalayas", "jobicy", "weworkremotely", "workingnomads"]) {
    assert.equal(queries.filter((q) => q.source === source).length, 1, source);
  }
  assert.ok(queries.every((q) => q.searchTerms?.includes("UX Designer")));
  assert.equal(queries.find((q) => q.source === "weworkremotely")!.family, "tech_digital");
  assert.ok(FREE_BOARD_SHARE < 0.5);
});
