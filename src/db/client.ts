import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { loadLocalEnv } from "@/lib/env";
import * as schema from "./schema";

type SqlClient = NeonQueryFunction<false, false>;
type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let sqlClient: SqlClient | null = null;
let dbInstance: DbInstance | null = null;

function requireDatabaseUrl(): string {
  loadLocalEnv();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it to your Neon PostgreSQL connection string (use the pooled URL on Vercel).",
    );
  }
  return url;
}

/** Raw Neon SQL client — for migrations and one-off queries. */
export function getSql(): SqlClient {
  if (!sqlClient) {
    sqlClient = neon(requireDatabaseUrl());
  }
  return sqlClient;
}

export function getDb(): DbInstance {
  if (!dbInstance) {
    dbInstance = drizzle(getSql(), { schema });
  }
  return dbInstance;
}

/** Neon is durable; kept for call-site compatibility (always false). */
export function isEphemeralDatabase() {
  return false;
}

export type Db = ReturnType<typeof getDb>;
