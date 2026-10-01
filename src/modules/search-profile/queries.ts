import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobSearchProfiles } from "@/db/schema";
import {
  parseJobSearchParams,
  type JobSearchParams,
} from "./schemas";
import { currentUserId, owned } from "@/modules/auth/current-user";
import { applyRemoteChoice, getSurvey } from "@/modules/onboarding/survey";

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

export async function getApprovedSearchProfile(): Promise<SearchProfileRow | null> {
  return getApprovedSearchProfileFor(await currentUserId());
}

/** Per-request memo: the layout, Today page and job hydration all read it. */
const getApprovedSearchProfileFor = cache(
  async (userId: string): Promise<SearchProfileRow | null> => {
    const row = (await getDb()
      .select()
      .from(jobSearchProfiles)
      .where(
        and(
          eq(jobSearchProfiles.userId, userId),
          eq(jobSearchProfiles.status, "approved"),
        ),
      )
      .limit(1))[0];
    if (!row) return null;
    const approved = mapRow(row);
    // Remote-only is the survey's call, also for criteria approved before that rule.
    return { ...approved, params: applyRemoteChoice(approved.params, await getSurvey()) };
  },
);

export async function getLatestDraftSearchProfile(): Promise<SearchProfileRow | null> {
  const row = (await getDb()
    .select()
    .from(jobSearchProfiles)
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.status, "draft")))
    .orderBy(desc(jobSearchProfiles.version)).limit(1))[0];
  return row ? mapRow(row) : null;
}

export async function getSearchProfileById(id: string): Promise<SearchProfileRow | null> {
  const row = (await getDb()
    .select()
    .from(jobSearchProfiles)
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.id, id))).limit(1))[0];
  return row ? mapRow(row) : null;
}

/** Active criteria for collectors — approved only. */
export async function getActiveSearchParams(): Promise<{
  params: JobSearchParams;
  version: number;
  id: string;
} | null> {
  const approved = await getApprovedSearchProfile();
  if (!approved) return null;
  return {
    params: approved.params,
    version: approved.version,
    id: approved.id,
  };
}
