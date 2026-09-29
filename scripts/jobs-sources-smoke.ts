/** Read-only public contract check; never touches the app database or AI. */
import { parseAtsBoard, fetchAtsBoard } from "../src/modules/collectors/direct-ats";

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
