import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * Resolve a writable SQLite path.
 * Vercel serverless FS is read-only except /tmp — without this, login/signup
 * fail with SQLITE_READONLY. /tmp is ephemeral (per-instance); fine for demos,
 * not for durable production data.
 */
function resolveDbPath() {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "optra", "outreach.sqlite");
  }
  return path.join(process.cwd(), "data", "outreach.sqlite");
}

const dbPath = resolveDbPath();
const dataDir = path.dirname(dbPath);

let sqlite: Database.Database | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getSqlite() {
  if (!sqlite) {
    ensureDataDir();
    sqlite = new Database(dbPath);
    // WAL needs sibling -wal/-shm files; skip on ephemeral /tmp hosts when it fails.
    try {
      sqlite.pragma("journal_mode = WAL");
    } catch {
      sqlite.pragma("journal_mode = DELETE");
    }
    sqlite.pragma("foreign_keys = ON");
  }
  return sqlite;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getSqlite(), { schema });
  }
  return dbInstance;
}

export function isEphemeralDatabase() {
  return process.env.VERCEL === "1" && !process.env.DATABASE_PATH;
}

export type Db = ReturnType<typeof getDb>;
