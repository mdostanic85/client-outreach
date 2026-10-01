/** Read-only public contract check; never touches the app database or AI. */
import { parseAtsBoard, fetchAtsBoard } from "../src/modules/collectors/direct-ats";
import { BROWSER_USER_AGENT, fetchPage, OPTRA_USER_AGENT } from "../src/modules/collectors/polite-fetch";
import { linkedInSearchUrl, parseLinkedInSearch } from "../src/modules/collectors/linkedin";
import { helloWorldSearchUrl, parseHelloWorldListing } from "../src/modules/collectors/helloworld";
import { infostudSearchUrl, parseInfostudSearch } from "../src/modules/collectors/infostud";
import {
  collectHimalayas,
  collectJobicy,
  collectRemoteOk,
  collectWeWorkRemotely,
  collectWorkingNomads,
} from "../src/modules/collectors/remote-feeds";
import { assessWorkLocation } from "../src/modules/matching/work-location";

async function main() {
  for (const url of ["https://boards.greenhouse.io/figma", "https://jobs.lever.co/palantir", "https://jobs.ashbyhq.com/linear"]) {
    try {
      const board = parseAtsBoard(url);
      const jobs = await fetchAtsBoard(board);
      console.log(JSON.stringify({ source: board.source, board: board.slug, count: jobs.length, sampleTitle: jobs[0]?.title, descriptions: jobs.filter(j => j.description.length > 0).length }));
    } catch (error) {
      console.log(JSON.stringify({ url, error: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    }
  }
  // One listing page per direct board; no posting pages, so this stays a handful of requests.
  const boards: Array<[string, () => Promise<number>]> = [
    ["linkedin", async () => parseLinkedInSearch(await fetchPage(linkedInSearchUrl({ title: "Product Designer", location: "Remote", postedWithinHours: 168, maxResults: 10, source: "linkedin" }, true, 0), { source: "linkedin", userAgent: BROWSER_USER_AGENT })).length],
    ["helloworld", async () => parseHelloWorldListing(await fetchPage(helloWorldSearchUrl("dizajner", 0), { source: "helloworld", userAgent: OPTRA_USER_AGENT })).length],
    ["infostud", async () => parseInfostudSearch(await fetchPage(infostudSearchUrl("dizajner", 1), { source: "infostud", userAgent: OPTRA_USER_AGENT })).cards.length],
  ];
  for (const [source, run] of boards) {
    try {
      const cards = await run();
      console.log(JSON.stringify({ source, cards }));
      if (cards === 0) process.exitCode = 1;
    } catch (error) {
      console.log(JSON.stringify({ source, error: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    }
  }
  // Remote feeds: count, how many pass the Serbia check, and a sample row. These
  // adapters follow each board's documented format; this is the live check.
  const feedQuery = (source: "remoteok" | "himalayas" | "jobicy" | "weworkremotely" | "workingnomads") =>
    ({ title: "Designer", location: "Remote", postedWithinHours: 720, maxResults: 30, source, family: "tech_digital" }) as const;
  const feeds = {
    remoteok: () => collectRemoteOk(feedQuery("remoteok")),
    himalayas: () => collectHimalayas(feedQuery("himalayas")),
    jobicy: () => collectJobicy(feedQuery("jobicy")),
    weworkremotely: () => collectWeWorkRemotely(feedQuery("weworkremotely")),
    workingnomads: () => collectWorkingNomads(feedQuery("workingnomads")),
  };
  for (const [source, run] of Object.entries(feeds)) {
    try {
      const jobs = await run();
      const access = jobs.map((job) => assessWorkLocation(job, { places: ["Serbia"] }).home);
      console.log(JSON.stringify({
        source,
        count: jobs.length,
        serbiaOk: access.filter((a) => a === "ok").length,
        unclear: access.filter((a) => a === "unclear").length,
        blocked: access.filter((a) => a === "blocked").length,
        sample: jobs[0] ? { title: jobs[0].title, company: jobs[0].companyName, location: jobs[0].location, url: jobs[0].sourceUrl } : null,
      }));
      if (jobs.length === 0) process.exitCode = 1;
    } catch (error) {
      console.log(JSON.stringify({ source, error: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    }
  }
  try {
    const response = await fetch("https://freehire.me/api/v1/jobs?limit=1", { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    console.log(JSON.stringify({ source: "freehire", status: response.status, envelope: Object.keys(body), sampleFields: body.data?.[0] ? Object.keys(body.data[0]) : [] }));
  } catch (error) {
    console.log(JSON.stringify({ source: "freehire", error: error instanceof Error ? error.message : String(error) }));
  }
}
main().catch(() => { process.exitCode = 1; });
