import assert from "node:assert/strict";
import test from "node:test";
import { collectArbeitnow } from "../src/modules/collectors/arbeitnow";
import { asStringList, companyDomainFromPosting } from "../src/modules/collectors/posting-html";
import { collectRemotive } from "../src/modules/collectors/remotive";
import type { CollectorQuery } from "../src/modules/collectors/types";
import { fetchArbeitnowSignals } from "../src/modules/discovery/arbeitnow";
import { fetchRemotiveSignals } from "../src/modules/discovery/remotive";

/**
 * Remotive and Arbeitnow feed both job search (collectors) and client-outreach
 * discovery (hiring signals) through one HTTP client per board.
 */

type Route = { match: string; status?: number; body: unknown };

function withFetch(routes: Route[], run: () => Promise<void>) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    const route = routes.find((r) => url.includes(r.match));
    if (!route) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  }).then(() => calls);
}

const designerQuery: CollectorQuery = {
  title: "Product Designer",
  location: "",
  postedWithinHours: 72,
  maxResults: 10,
  source: "remotive",
  remotiveCategory: "design",
};

const remotiveJobs = {
  jobs: [
    {
      id: 7,
      url: "https://remotive.com/remote-jobs/design/7",
      title: "Senior Product Designer",
      company_name: "Acme Labs",
      job_type: "full_time",
      publication_date: "2026-09-28T10:00:00",
      candidate_required_location: "Europe",
      description:
        '<p>Join us.</p><a href="https://www.youtube.com/watch?v=1">video</a><a href="https://acmelabs.io/about">About</a>',
    },
    {
      id: 8,
      url: "https://remotive.com/remote-jobs/support/8",
      title: "Customer Support Agent",
      company_name: "Other Co",
      description: "<p>Support</p>",
    },
  ],
};

test("Remotive collector keeps title matches and maps them to raw jobs", async () => {
  let jobs: Awaited<ReturnType<typeof collectRemotive>> = [];
  const calls = await withFetch([{ match: "remotive.com/api", body: remotiveJobs }], async () => {
    jobs = await collectRemotive(designerQuery);
  });
  assert.equal(jobs.length, 1);
  const [job] = jobs;
  assert.equal(job!.externalId, "7");
  assert.equal(job!.remotePolicy, "remote");
  assert.equal(job!.companyDomain, "acmelabs.io", "social links are not the employer's site");
  assert.equal(job!.description, "Join us.videoAbout");
  assert.match(calls[0]!, /search=Product\+Designer/);
  assert.match(calls[0]!, /category=design/);
});

test("Remotive signals share the client and keep a short excerpt", async () => {
  let signals: Awaited<ReturnType<typeof fetchRemotiveSignals>> = [];
  const calls = await withFetch([{ match: "remotive.com/api", body: remotiveJobs }], async () => {
    signals = await fetchRemotiveSignals({ category: "design", limit: 1 });
  });
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.source, "remotive");
  assert.equal(signals[0]!.companyDomain, "acmelabs.io");
  assert.ok(signals[0]!.rawHash.length > 10);
  assert.doesNotMatch(calls[0]!, /search=/, "discovery reads the category feed, not a title search");
});

test("Remotive HTTP errors are reported, not swallowed", async () => {
  await withFetch([{ match: "remotive.com/api", status: 503, body: {} }], async () => {
    await assert.rejects(collectRemotive(designerQuery), /Remotive HTTP 503/);
    await assert.rejects(fetchRemotiveSignals(), /Remotive HTTP 503/);
  });
});

const arbeitnowPage = {
  data: [
    {
      slug: "ux-designer-berlin-1",
      company_name: "Berlin Studio GmbH",
      title: "UX Designer",
      url: "https://www.arbeitnow.com/jobs/ux-designer-berlin-1",
      remote: true,
      location: "Berlin",
      job_types: { 0: "Full Time" },
      created_at: 1_790_000_000,
      description: '<a href="https://berlinstudio.de">Site</a>',
    },
  ],
};

test("Arbeitnow collector keeps earlier pages when a later page is refused", async () => {
  let jobs: Awaited<ReturnType<typeof collectArbeitnow>> = [];
  await withFetch(
    [
      { match: "page=1", body: arbeitnowPage },
      { match: "page=2", status: 429, body: {} },
    ],
    async () => {
      jobs = await collectArbeitnow({ ...designerQuery, title: "UX Designer", source: "arbeitnow" });
    },
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.employmentType, "Full Time");
  assert.equal(jobs[0]!.remotePolicy, "remote");
  assert.equal(jobs[0]!.companyDomain, "berlinstudio.de");
  assert.equal(jobs[0]!.postedAt, new Date(1_790_000_000 * 1000).toISOString());
});

test("Arbeitnow signals fail loudly on HTTP errors", async () => {
  await withFetch([{ match: "page=1", status: 500, body: {} }], async () => {
    await assert.rejects(fetchArbeitnowSignals(), /Arbeitnow fetch failed: HTTP 500/);
  });
});

test("posting helpers normalise list fields and skip board links", () => {
  assert.deepEqual(asStringList(["a", 1, "b"]), ["a", "b"]);
  assert.deepEqual(asStringList({ 0: "Sales" }), ["Sales"]);
  assert.deepEqual(asStringList("Remote"), ["Remote"]);
  assert.deepEqual(asStringList(null), []);
  assert.equal(
    companyDomainFromPosting('<a href="https://arbeitnow.com/x">x</a>', "Any", /arbeitnow\.com/),
    undefined,
  );
});
