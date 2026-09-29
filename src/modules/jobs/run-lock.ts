import { mkdir, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";

/** Fail closed on stale locks; never start a second scheduled worker automatically. */
export async function withLocalJobLock<T>(path: string, run: () => Promise<T>): Promise<T | { skipped: "already_running" }> {
  await mkdir(dirname(path), { recursive: true });
  let file;
  try { file = await open(path, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return { skipped: "already_running" };
    throw error;
  }
  try {
    await file.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return await run();
  } finally {
    await file.close();
    await unlink(path);
  }
}
