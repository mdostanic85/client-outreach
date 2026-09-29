import { resolve } from "node:path";
import { loadLocalEnv } from "../src/lib/env";
import { withLocalJobLock } from "../src/modules/jobs/run-lock";

async function main() {
  loadLocalEnv();
  const result = await withLocalJobLock(resolve("data/jobs-worker.lock"), async () => {
    const { ensureDb } = await import("../src/db/ensure");
    const { listUserIds, runAsUser } = await import("../src/modules/auth/current-user");
    const { runJobDiscoveryPipeline } = await import("../src/modules/jobs/pipeline");
    await ensureDb();
    // Every account gets its own discovery run against its own search criteria.
    const results: Record<string, unknown> = {};
    for (const userId of await listUserIds()) {
      results[userId] = await runAsUser(userId, () => runJobDiscoveryPipeline());
    }
    return results;
  });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => {
  console.error("Job worker failed. Check source run history and local configuration.");
  process.exitCode = 1;
});
