import { getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { loadLocalEnv } from "@/lib/env";

let initialized = false;
let initPromise: Promise<ReturnType<typeof getDb>> | null = null;

/** Runs migrations once per process. Per-account settings are created lazily (getUserSettings). */
export async function ensureDb() {
  loadLocalEnv();
  if (initialized) return getDb();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await runMigrations();
    initialized = true;
    return getDb();
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}
