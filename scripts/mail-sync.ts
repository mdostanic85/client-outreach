#!/usr/bin/env tsx
/**
 * Sync mailbox INBOX for replies / bounces / opt-outs.
 *
 *   pnpm mail:sync
 */
import { ensureDb } from "../src/db/ensure";
import { syncInbox } from "../src/modules/mail/sync";
import { runAsOwner } from "../src/modules/auth/current-user";

async function main() {
  await ensureDb();
  const result = await runAsOwner(() => syncInbox());
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
