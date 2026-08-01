#!/usr/bin/env tsx
/**
 * Sync Gmail INBOX for replies / bounces / opt-outs.
 *
 *   pnpm mail:sync
 */
import { ensureDb } from "../src/db/ensure";
import { syncInbox } from "../src/modules/mail/sync";

async function main() {
  ensureDb();
  const result = await syncInbox();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
