#!/usr/bin/env tsx
/**
 * Local worker: discover → filter → triage → research → publish daily list.
 *
 * Usage:
 *   pnpm worker
 *   pnpm worker --resume <runId>
 */
import { runWorkerPipeline } from "../src/modules/tracking/worker";

async function main() {
  const args = process.argv.slice(2);
  const resumeIdx = args.indexOf("--resume");
  const resumeRunId =
    resumeIdx >= 0 ? args[resumeIdx + 1] : undefined;

  const result = await runWorkerPipeline({ resumeRunId });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
