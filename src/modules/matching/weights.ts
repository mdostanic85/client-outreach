import { getDb } from "@/db/client";
import { settingsJobScoring } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { currentUserId, owned } from "@/modules/auth/current-user";
import {
  JOB_MATCH_DIM_KEYS,
  renameLegacyDimKeys,
  resolveJobMatchWeights,
  defaultWeightsFor,
  type JobMatchDimKey,
} from "@/modules/matching/score";
import type { OccupationFamily } from "@/modules/occupations/families";

function parseWeightsJson(
  raw: string | null | undefined,
): Partial<Record<JobMatchDimKey, number>> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = renameLegacyDimKeys(JSON.parse(raw) as Record<string, unknown>);
    const out: Partial<Record<JobMatchDimKey, number>> = {};
    for (const key of JOB_MATCH_DIM_KEYS) {
      const v = parsed[key];
      if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** Active job-match weights for the current account (family defaults when unset). */
export async function getJobMatchWeights(
  family?: OccupationFamily | null,
): Promise<Record<JobMatchDimKey, number>> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(settingsJobScoring)
      .where(await owned(settingsJobScoring))
      .limit(1)
  )[0];
  return resolveJobMatchWeights(parseWeightsJson(row?.weightsJson), family);
}

export async function setJobMatchWeights(
  weights: Partial<Record<JobMatchDimKey, number>>,
  family?: OccupationFamily | null,
): Promise<Record<JobMatchDimKey, number>> {
  const resolved = resolveJobMatchWeights(
    { ...defaultWeightsFor(family), ...weights },
    family,
  );
  const db = getDb();
  const now = nowIso();
  const mine = await owned(settingsJobScoring);
  const existing = (
    await db.select().from(settingsJobScoring).where(mine).limit(1)
  )[0];
  const payload = JSON.stringify(resolved);
  if (existing) {
    await db
      .update(settingsJobScoring)
      .set({ weightsJson: payload, updatedAt: now })
      .where(mine);
  } else {
    await db.insert(settingsJobScoring).values({
      id: newId("jscw"),
      userId: await currentUserId(),
      weightsJson: payload,
      updatedAt: now,
    });
  }
  return resolved;
}
