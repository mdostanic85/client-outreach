import { resolve } from "node:path";
import { loadLocalEnv } from "../src/lib/env";
import { withLocalJobLock } from "../src/modules/jobs/run-lock";

async function main() {
  loadLocalEnv();
  const result = await withLocalJobLock(resolve("data/jobs-worker.lock"), async () => {
    const { runJobDiscoveryPipeline } = await import("../src/modules/jobs/pipeline");
    return runJobDiscoveryPipeline();
  });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => {
  console.error("Job worker failed. Check source run history and local configuration.");
  process.exitCode = 1;
});
