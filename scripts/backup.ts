#!/usr/bin/env tsx
/**
 * Local SQLite backup with rotation: 7 daily + 4 weekly copies.
 * Relies on FileVault (or encrypt the backup separately).
 *
 * Usage: npm run backup
 */
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "outreach.sqlite");
const backupDir = path.join(dataDir, "backups");

const DAILY_KEEP = 7;
const WEEKLY_KEEP = 4;

function parseStamp(name: string): Date | null {
  const m = name.match(
    /outreach-(?:weekly-)?(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/,
  );
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function listBackups(filter: (name: string) => boolean) {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((n) => n.endsWith(".sqlite") && filter(n))
    .map((name) => ({
      name,
      path: path.join(backupDir, name),
      date: parseStamp(name) ?? new Date(0),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function removeWithSidecars(filePath: string) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${filePath}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function rotate(files: Array<{ name: string; path: string }>, keep: number) {
  for (const stale of files.slice(keep)) {
    removeWithSidecars(stale.path);
    console.log(`Rotated out: ${stale.name}`);
  }
}

function main() {
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `outreach-${stamp}.sqlite`);

  fs.copyFileSync(dbPath, dest);
  for (const suffix of ["-wal", "-shm"]) {
    const side = `${dbPath}${suffix}`;
    if (fs.existsSync(side)) {
      fs.copyFileSync(side, `${dest}${suffix}`);
    }
  }
  fs.chmodSync(dest, 0o600);
  console.log(`Daily backup written: ${dest}`);

  // Weekly snapshot on Mondays (UTC)
  if (new Date().getUTCDay() === 1) {
    const weekly = path.join(backupDir, `outreach-weekly-${stamp}.sqlite`);
    fs.copyFileSync(dest, weekly);
    fs.chmodSync(weekly, 0o600);
    console.log(`Weekly backup written: ${weekly}`);
  }

  const daily = listBackups(
    (n) => n.startsWith("outreach-") && !n.startsWith("outreach-weekly-"),
  );
  const weekly = listBackups((n) => n.startsWith("outreach-weekly-"));
  rotate(daily, DAILY_KEEP);
  rotate(weekly, WEEKLY_KEEP);

  console.log("Ensure FileVault (or equivalent) is enabled for encryption at rest.");
}

main();
