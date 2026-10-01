import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseAtsBoard, normalizeAtsPayload, fetchAtsBoard, plannedAtsBoards, collectDirectBoard } from "../src/modules/collectors/direct-ats";
import { canonicalJobUrl } from "../src/modules/collectors/identity";
import { EMPTY_SEARCH_PARAMS, normalizeCollectorParams } from "../src/modules/search-profile/schemas";
import { filterRawJobs } from "../src/modules/jobs/filters";
import { evaluationCacheVersion, opportunitySignal } from "../src/modules/matching/v2-signals";
import { validateGrounding, buildPackageWarnings } from "../src/modules/applications/grounding";
import { StructuredProfileSchema } from "../src/modules/profile/schemas";
import { TailoredCvSchema, CoverLetterSchema } from "../src/modules/applications/schemas";
import { withLocalJobLock } from "../src/modules/jobs/run-lock";
import { createMcpHandler } from "../src/modules/mcp/protocol";

const gh = parseAtsBoard("https://boards.greenhouse.io/acme");
const posting = { id: 1, title: "Senior Product Designer", absolute_url: "https://example.com/jobs/1", content: "&lt;p&gt;Design &amp;amp; build&lt;/p&gt;", location: { name: "Remote Europe" }, updated_at: "2026-09-29" };
const raw = normalizeAtsPayload(gh, { jobs: [posting] })[0]!;
/** Remote product-design search (EMPTY_SEARCH_PARAMS assumes no occupation). */
const designRemote = { ...EMPTY_SEARCH_PARAMS, targetTitles: ["Senior Product Designer"], locations: ["Remote"], remoteRequired: true, remotePolicy: "remote_ok_required" as const };

test("strict board hosts and path validation, including Lever EU", () => {
  assert.match(parseAtsBoard("https://jobs.eu.lever.co/acme").endpoint, /^https:\/\/api.eu.lever.co/);
  for (const url of ["http://jobs.lever.co/acme", "https://jobs.lever.co.evil.test/acme", "https://user@jobs.lever.co/acme", "https://127.0.0.1/acme", "https://jobs.lever.co/acme/posting", "https://jobs.lever.co:8443/acme", "https://jobs.lever.co/%2e%2e"]) {
    assert.throws(() => parseAtsBoard(url), url);
  }
});

test("Greenhouse strips encoded markup without fabricating publication or company domain", () => {
  assert.equal(raw.description, "Design & build");
  assert.equal(raw.postedAt, undefined);
  assert.equal(raw.companyDomain, undefined);
  assert.equal(raw.externalId, "us:acme:1");
  assert.notEqual(normalizeAtsPayload(parseAtsBoard("https://boards.greenhouse.io/another"), { jobs: [posting] })[0]!.externalId, raw.externalId);
  assert.throws(() => normalizeAtsPayload(gh, {}));
  assert.deepEqual(normalizeAtsPayload(gh, { jobs: [{ ...posting, absolute_url: "javascript:alert(1)" }, posting] }).map(j => j.externalId), ["us:acme:1"]);
});

test("Lever retains requirements and workplace mode", () => {
  const job = normalizeAtsPayload(parseAtsBoard("https://jobs.lever.co/acme"), [{ id: "a", text: posting.title, hostedUrl: posting.absolute_url, descriptionPlain: "Intro", lists: [{ text: "Requirements", content: "<li>Figma</li>" }], workplaceType: "hybrid", categories: { commitment: "Full-time" } }])[0]!;
  assert.match(job.description, /Requirements Figma/);
  assert.equal(job.remotePolicy, "hybrid");
  assert.equal(filterRawJobs([job], designRemote).dropped[0]?.reason, "remote_required");
  assert.equal(filterRawJobs([job], { ...designRemote, remoteRequired: false, remotePolicy: "any" }).kept.length, 1);
});

test("Ashby excludes unlisted postings, preserves explicit remote and valid dates", () => {
  const board = parseAtsBoard("https://jobs.ashbyhq.com/acme");
  const job = { id: "a", title: posting.title, jobUrl: posting.absolute_url, isRemote: true, publishedAt: "2026-09-29T00:00:00Z" };
  assert.equal(normalizeAtsPayload(board, { jobs: [{ ...job, isListed: false }] }).length, 0);
  assert.equal(normalizeAtsPayload(board, { jobs: [job] })[0]?.remotePolicy, "remote");
  assert.equal(normalizeAtsPayload(board, { jobs: [{ ...job, isRemote: false, publishedAt: "yesterday" }] })[0]?.postedAt, undefined);
});

test("HTTP handling honors long cooldowns and forbids redirects", async () => {
  let calls = 0;
  const limited: typeof fetch = async () => { calls++; return new Response("", { status: 429, headers: { "retry-after": "60" } }); };
  await assert.rejects(fetchAtsBoard(gh, limited), /retry later/);
  assert.equal(calls, 1);
  const transient: typeof fetch = async (_url, init) => {
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    calls++;
    return calls === 2 ? new Response("", { status: 503, headers: { "retry-after": "0" } }) : Response.json({ jobs: [posting] });
  };
  assert.equal((await fetchAtsBoard(gh, transient)).length, 1);
  assert.equal(calls, 3);
  await assert.rejects(fetchAtsBoard(gh, async () => Response.json({ wrong: [] })), /jobs/);
});

test("source preferences survive normalization and board planning does not require Apify", () => {
  const params = normalizeCollectorParams({ ...EMPTY_SEARCH_PARAMS, sourcesEnabled: ["greenhouse"], atsBoardUrls: ["https://boards.greenhouse.io/acme", "https://job-boards.greenhouse.io/acme", "https://jobs.lever.co/acme", "https://invalid.test/acme"] });
  assert.deepEqual(params.sourcesEnabled, ["greenhouse"]);
  const plan = plannedAtsBoards(params);
  assert.equal(plan.length, 2);
  assert.ok(plan[0]?.board);
  assert.ok(plan[1]?.error);
  assert.deepEqual(plannedAtsBoards({ ...params, sourcesEnabled: [] }), []);
  assert.deepEqual(EMPTY_SEARCH_PARAMS.atsBoardUrls, [], "no occupation-specific boards by default");
  assert.ok(!EMPTY_SEARCH_PARAMS.sourcesEnabled.includes("greenhouse"));
});

test("direct board relevance precedes truncation and respects the remaining cap", async () => {
  const response: typeof fetch = async () => Response.json({ jobs: [
    { ...posting, id: 2, title: "Accountant" }, posting,
    { ...posting, id: 3, absolute_url: "https://example.com/jobs/3" },
  ] });
  const collected = await collectDirectBoard(gh, designRemote, 1, response);
  assert.equal(collected.length, 1);
  assert.equal(collected[0]?.title, posting.title);
  assert.equal((await collectDirectBoard(gh, designRemote, 0, response)).length, 0);
});

test("identity keeps distinct requisitions and removes attribution-only duplicates", () => {
  const second = { ...raw, externalId: "2", sourceUrl: "https://example.com/jobs/2" };
  assert.equal(filterRawJobs([raw, second], designRemote).kept.length, 2);
  const duplicate = { ...raw, source: "apify", externalId: "other", sourceUrl: raw.sourceUrl + "?utm_source=feed#apply" };
  assert.equal(filterRawJobs([raw, duplicate], designRemote).kept.length, 1);
  assert.notEqual(canonicalJobUrl("https://example.com/jobs?gh_jid=1"), canonicalJobUrl("https://example.com/jobs?gh_jid=2"));
  const flagged = filterRawJobs([raw], designRemote).softFlagged[0]!;
  assert.ok(flagged.flags.includes("unknown_posted_date"));
  assert.ok(flagged.flags.includes("unconfirmed_remote"));
});

test("AI cache invalidates for evidence, criteria, model and profile changes", () => {
  const input = { promptVersion: "v1", model: "test", profileJson: "{}", searchProfileVersion: 1, searchParams: EMPTY_SEARCH_PARAMS, job: raw };
  const key = evaluationCacheVersion(input);
  for (const changed of [{ ...input, model: "new" }, { ...input, searchProfileVersion: 2 }, { ...input, profileJson: '{"role":"designer"}' }, { ...input, job: { ...raw, description: "changed" } }, { ...input, searchParams: { ...EMPTY_SEARCH_PARAMS, remoteRequired: true } }]) {
    assert.notEqual(evaluationCacheVersion(changed), key);
  }
  assert.equal(evaluationCacheVersion({ ...input, job: { ...raw, updatedAt: "today" } } as typeof input), key);
});

test("opportunity is bounded and unknown dates receive no freshness bonus", () => {
  const unknown = opportunitySignal(raw);
  assert.ok(unknown.unknowns.includes("publication_date"));
  assert.equal(unknown.score, 30);
  const full = opportunitySignal({ ...raw, description: "a".repeat(350), postedAt: "2026-09-29T00:00:00Z", remotePolicy: "remote" }, Date.parse("2026-09-29T12:00:00Z"));
  assert.equal(full.score, 100);
});

test("CV and letter metric inventions block approval warnings, supported metrics pass", () => {
  const profile = StructuredProfileSchema.parse({ achievements: ["Increased conversion by 25%"] });
  const cv = TailoredCvSchema.parse({ fullName: "Example", summary: "Increased conversion by 25%" });
  const letter = CoverLetterSchema.parse({});
  assert.equal(validateGrounding({ profile, cv, letter }).ok, true);
  const grounding = validateGrounding({ profile, cv: { ...cv, summary: "Increased conversion by 5%" }, letter: { ...letter, body: "Grew to 1000 users" } });
  assert.equal(grounding.rejectedClaims.length, 2);
  const warnings = buildPackageWarnings({ hasDescription: true, projectCount: 1, experienceCount: 1, gaps: [], grounding, marketConfirmed: true });
  assert.equal(warnings.find(w => w.code === "grounding_failed")?.severity, "block");
});

test("scheduled worker lock prevents overlap and releases after failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jobfinder-test-"));
  try {
    const path = join(dir, "lock");
    await withLocalJobLock(path, async () => {
      assert.deepEqual(await withLocalJobLock(path, async () => { throw new Error("must not run"); }), { skipped: "already_running" });
    });
    await assert.rejects(withLocalJobLock(path, async () => { throw new Error("failed"); }));
    assert.equal(await withLocalJobLock(path, async () => 42), 42);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("MCP lifecycle, bounded read-only tools and redacted failures", async () => {
  let calls = 0;
  const handle = createMcpHandler({ list: async limit => { calls++; return [{ limit }]; }, detail: async () => { throw new Error("postgres://secret"); } });
  const invoke = (method: string, params?: unknown) => handle(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));
  assert.match(JSON.stringify(await invoke("tools/list")), /Initialize/);
  await invoke("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(await handle('{"jsonrpc":"2.0","method":"notifications/initialized"}'), null);
  assert.match(JSON.stringify(await invoke("tools/list")), /readOnlyHint/);
  await invoke("tools/call", { name: "list_jobs", arguments: { limit: 51 } });
  assert.equal(calls, 0);
  assert.match(JSON.stringify(await invoke("tools/call", { name: "send_mail" })), /Unknown tool/);
  await invoke("tools/call", { name: "list_jobs", arguments: { limit: 2 } });
  assert.equal(calls, 1);
  const failure = JSON.stringify(await invoke("tools/call", { name: "get_job", arguments: { id: "job_1" } }));
  assert.match(failure, /isError/);
  assert.ok(!failure.includes("secret"));
  assert.match(JSON.stringify(await handle("invalid")), /Parse error/);
});
