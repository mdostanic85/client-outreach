import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources, structuredProfiles } from "@/db/schema";
import {
  parseStructuredProfile,
  type StructuredProfile,
} from "./schemas";

export type ProfileSourceRow = typeof profileSources.$inferSelect;
export type StructuredProfileRow = typeof structuredProfiles.$inferSelect;

export type StructuredProfileView = StructuredProfileRow & {
  profile: StructuredProfile;
  sourceIds: string[];
};

function toView(row: StructuredProfileRow): StructuredProfileView {
  let sourceIds: string[] = [];
  try {
    sourceIds = JSON.parse(row.sourceIdsJson || "[]") as string[];
  } catch {
    sourceIds = [];
  }
  return {
    ...row,
    profile: parseStructuredProfile(row.profileJson),
    sourceIds,
  };
}

/** Active (non-deleted) sources only. */
export function listProfileSources(): ProfileSourceRow[] {
  return getDb()
    .select()
    .from(profileSources)
    .where(isNull(profileSources.deletedAt))
    .orderBy(desc(profileSources.ingestedAt))
    .all();
}

export function listAllProfileSourcesIncludingDeleted(): ProfileSourceRow[] {
  return getDb()
    .select()
    .from(profileSources)
    .orderBy(desc(profileSources.ingestedAt))
    .all();
}

export function getProfileSource(id: string): ProfileSourceRow | undefined {
  return getDb()
    .select()
    .from(profileSources)
    .where(eq(profileSources.id, id))
    .get();
}

export function getLatestDraftProfile(): StructuredProfileView | null {
  const row = getDb()
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.status, "draft"))
    .orderBy(desc(structuredProfiles.version))
    .get();
  return row ? toView(row) : null;
}

export function getApprovedProfile(): StructuredProfileView | null {
  const row = getDb()
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.status, "approved"))
    .orderBy(desc(structuredProfiles.approvedAt), desc(structuredProfiles.version))
    .get();
  return row ? toView(row) : null;
}

export function getStructuredProfileById(
  id: string,
): StructuredProfileView | null {
  const row = getDb()
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.id, id))
    .get();
  return row ? toView(row) : null;
}

export function listStructuredProfiles(limit = 20): StructuredProfileView[] {
  return getDb()
    .select()
    .from(structuredProfiles)
    .orderBy(desc(structuredProfiles.version))
    .limit(limit)
    .all()
    .map(toView);
}

/** Profile used for matching — approved only. */
export function getMatchingProfile(): StructuredProfile | null {
  return getApprovedProfile()?.profile ?? null;
}
