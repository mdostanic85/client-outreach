#!/usr/bin/env tsx
/**
 * Prune expired contact PII and raw signal payloads per retention policy.
 *
 * Usage:
 *   npm run retention           # dry run
 *   npm run retention -- --apply
 */
import { ensureDb } from "../src/db/ensure";
import { runRetentionPrune } from "../src/modules/privacy/retention";

const apply = process.argv.includes("--apply");
await ensureDb();
const result = await runRetentionPrune({ dryRun: !apply });
console.log(JSON.stringify(result, null, 2));
if (!apply) {
  console.log("\nDry run only. Pass --apply to delete.");
}
