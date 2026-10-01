import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

/**
 * Starts the real MCP server process (`scripts/jobs-mcp.ts`), which opens the
 * database on boot. Needs DATABASE_URL: run with `npm run test:integration`.
 */
test("MCP stdio emits only JSON-RPC and handles initialization notifications", () => {
  const requests = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ];
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/jobs-mcp.ts"], { encoding: "utf8", input: requests.map(r => JSON.stringify(r)).join("\n") + "\n", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  const replies = result.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(replies.length, 2);
  assert.deepEqual(replies[1].result.tools.map((t: { name: string }) => t.name), ["list_jobs", "get_job"]);
});
