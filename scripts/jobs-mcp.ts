import { createInterface } from "node:readline";
import { loadLocalEnv } from "../src/lib/env";
import { createMcpHandler } from "../src/modules/mcp/protocol";
import { jobReader, type JobReader } from "../src/modules/mcp/job-tools";
import { ensureDb } from "../src/db/ensure";
import { getOwnerUserId, runAsUser } from "../src/modules/auth/current-user";

const noAccountReader: JobReader = {
  list: async () => { throw new Error("No account yet. Sign up in the app first."); },
  detail: async () => { throw new Error("No account yet. Sign up in the app first."); },
};

async function main() {
  loadLocalEnv();
  await ensureDb();
  // Read-only MCP answers for the workspace owner; protocol calls still work before signup.
  const ownerId = await getOwnerUserId();
  const handle = createMcpHandler(ownerId ? jobReader : noAccountReader);
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (line.length > 65536) { process.stderr.write("MCP request exceeds limit\n"); continue; }
    const response = ownerId ? await runAsUser(ownerId, () => handle(line)) : await handle(line);
    if (response !== null) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
main().catch(() => { process.stderr.write("MCP server stopped\n"); process.exitCode = 1; });
