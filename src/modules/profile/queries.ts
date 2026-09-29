import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources, structuredProfiles } from "@/db/schema";
import { owned } from "@/modules/auth/current-user";
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
export async function listProfileSources(): Promise<ProfileSourceRow[]> {
  return await getDb()
    .select()
    .from(profileSources)
    .where(and(await owned(profileSources), isNull(profileSources.deletedAt)))
    .orderBy(desc(profileSources.ingestedAt));
}

export async function listAllProfileSourcesIncludingDeleted(): Promise<ProfileSourceRow[]> {
  return await getDb()
    .select()
    .from(profileSources)
    .where(await owned(profileSources))
    .orderBy(desc(profileSources.ingestedAt));
}

export async function getProfileSource(id: string): Promise<ProfileSourceRow | undefined> {
  return (await getDb()
    .select()
    .from(profileSources)
    .where(and(await owned(profileSources), eq(profileSources.id, id))).limit(1))[0];
}

export async function getLatestDraftProfile(): Promise<StructuredProfileView | null> {
  const row = (await getDb()
    .select()
    .from(structuredProfiles)
    .where(and(await owned(structuredProfiles), eq(structuredProfiles.status, "draft")))
    .orderBy(desc(structuredProfiles.version)).limit(1))[0];
  return row ? toView(row) : null;
}

export async function getApprovedProfile(): Promise<StructuredProfileView | null> {
  const row = (await getDb()
    .select()
    .from(structuredProfiles)
    .where(and(await owned(structuredProfiles), eq(structuredProfiles.status, "approved")))
    .orderBy(desc(structuredProfiles.approvedAt), desc(structuredProfiles.version)).limit(1))[0];
  return row ? toView(row) : null;
}

export async function getStructuredProfileById(
  id: string,
): Promise<StructuredProfileView | null> {
  const row = (await getDb()
    .select()
    .from(structuredProfiles)
    .where(and(await owned(structuredProfiles), eq(structuredProfiles.id, id))).limit(1))[0];
  return row ? toView(row) : null;
}

export async function listStructuredProfiles(limit = 20): Promise<StructuredProfileView[]> {
  return (await getDb()
    .select()
    .from(structuredProfiles)
    .where(await owned(structuredProfiles))
    .orderBy(desc(structuredProfiles.version))
    .limit(limit))
    .map(toView);
}

/** Profile used for matching — approved only. */
export async function getMatchingProfile(): Promise<StructuredProfile | null> {
  return (await getApprovedProfile())?.profile ?? null;
}
