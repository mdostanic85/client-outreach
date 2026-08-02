#!/usr/bin/env tsx
/**
 * Process approved send queue (SMTP via Gmail app password).
 *
 *   pnpm mail:send
 *   pnpm mail:send --limit 2
 */
import { ensureDb } from "../src/db/ensure";
import { processSendQueue } from "../src/modules/mail/send";

async function main() {
  await ensureDb();
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;
  const result = await processSendQueue(
    Number.isFinite(limit) ? limit : undefined,
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
