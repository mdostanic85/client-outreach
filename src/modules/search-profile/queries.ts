import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobSearchProfiles } from "@/db/schema";
import {
  parseJobSearchParams,
  type JobSearchParams,
} from "./schemas";

export type SearchProfileRow = {
  id: string;
  version: number;
  status: string;
  params: JobSearchParams;
  rationale: string[];
  structuredProfileId: string | null;
  structuredProfileVersion: number | null;
  generationTrigger: string;
  modelId: string | null;
  promptVersion: string | null;
  createdAt: string;
  approvedAt: string | null;
};

function mapRow(
  row: typeof jobSearchProfiles.$inferSelect,
): SearchProfileRow {
  let rationale: string[] = [];
  try {
    rationale = JSON.parse(row.rationaleJson || "[]") as string[];
  } catch {
    rationale = [];
  }
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    params: parseJobSearchParams(row.paramsJson),
    rationale,
    structuredProfileId: row.structuredProfileId,
    structuredProfileVersion: row.structuredProfileVersion,
    generationTrigger: row.generationTrigger,
    modelId: row.modelId,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
  };
}

export function getApprovedSearchProfile(): SearchProfileRow | null {
  const row = getDb()
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.status, "approved"))
    .get();
  return row ? mapRow(row) : null;
}

export function getLatestDraftSearchProfile(): SearchProfileRow | null {
  const row = getDb()
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.status, "draft"))
    .orderBy(desc(jobSearchProfiles.version))
    .get();
  return row ? mapRow(row) : null;
}

export function getSearchProfileById(id: string): SearchProfileRow | null {
  const row = getDb()
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.id, id))
    .get();
  return row ? mapRow(row) : null;
}

/** Active criteria for collectors — approved only. */
export function getActiveSearchParams(): {
  params: JobSearchParams;
  version: number;
  id: string;
} | null {
  const approved = getApprovedSearchProfile();
  if (!approved) return null;
  return {
    params: approved.params,
    version: approved.version,
    id: approved.id,
  };
}
