#!/usr/bin/env tsx
/**
 * Database backups are handled by Neon (point-in-time recovery / snapshots).
 * This script no longer backs up a local SQLite file.
 *
 * Usage: npm run backup
 */
console.log(
  "SQLite file backups are retired. Use Neon’s dashboard for backups and PITR on DATABASE_URL.",
);
process.exit(0);
