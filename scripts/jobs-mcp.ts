import { createInterface } from "node:readline";
import { loadLocalEnv } from "../src/lib/env";
import { createMcpHandler } from "../src/modules/mcp/protocol";
import { jobReader } from "../src/modules/mcp/job-tools";

async function main() {
  loadLocalEnv();
  const handle = createMcpHandler(jobReader);
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (line.length > 65536) { process.stderr.write("MCP request exceeds limit\n"); continue; }
    const response = await handle(line);
    if (response !== null) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
main().catch(() => { process.stderr.write("MCP server stopped\n"); process.exitCode = 1; });
