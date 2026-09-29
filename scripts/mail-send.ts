#!/usr/bin/env tsx
/**
 * Process approved send queue (SMTP via configured mailbox).
 *
 *   pnpm mail:send
 *   pnpm mail:send --limit 2
 */
import { ensureDb } from "../src/db/ensure";
import { processSendQueue } from "../src/modules/mail/send";
import { runAsOwner } from "../src/modules/auth/current-user";

async function main() {
  await ensureDb();
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;
  // The mailbox belongs to the workspace owner.
  const result = await runAsOwner(() =>
    processSendQueue(Number.isFinite(limit) ? limit : undefined),
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
