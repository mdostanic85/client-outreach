import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources, settings } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import {
  MatchingSourcesConfigSchema,
  parseMatchingSourcesConfig,
  resolveMatchingSourcesForScoring as resolveMatchingSourcesForScoringCore,
  type MatchingSourcesConfig,
} from "./matching-sources-core";
import { owned } from "@/modules/auth/current-user";
import { getUserSettings } from "@/modules/settings/user-settings";

export {
  DEFAULT_MATCHING_SOURCES,
  MATCHING_SOURCE_COPY,
  MatchingSourcesConfigSchema,
  isPortfolioProjectEvidence,
  matchingPromptSuffix,
  parseMatchingSourcesConfig,
  profileForMatching,
  type MatchingSourcesConfig,
} from "./matching-sources-core";

export async function getMatchingSourcesConfig(): Promise<MatchingSourcesConfig> {
  const row = (await getUserSettings());
  return parseMatchingSourcesConfig(
    row?.matchingSourcesJson,
    row?.usePortfolioInMatching,
  );
}

/**
 * Combine category toggles with per-source enabledForMatching flags.
 * Loads sources from the DB when not provided.
 */
export async function resolveMatchingSourcesForScoring(
  config?: MatchingSourcesConfig,
  sources?: Array<{ type: string; enabledForMatching: number | boolean }>,
): Promise<MatchingSourcesConfig> {
  const resolvedConfig = config ?? (await getMatchingSourcesConfig());
  const list =
    sources ??
    (await getDb()
      .select()
      .from(profileSources)
      .where(and(await owned(profileSources), isNull(profileSources.deletedAt))))
      .map((s) => ({
        type: s.type,
        enabledForMatching: s.enabledForMatching,
      }));

  return resolveMatchingSourcesForScoringCore(resolvedConfig, list);
}

export async function setMatchingSourcesConfig(
  patch: Partial<MatchingSourcesConfig>,
): Promise<MatchingSourcesConfig> {
  const db = getDb();
  const row = (await getUserSettings());
  if (!row) throw new Error("Settings missing");

  const next = MatchingSourcesConfigSchema.parse({
    ...(await getMatchingSourcesConfig()),
    ...patch,
  });

  await db.update(settings)
    .set({
      matchingSourcesJson: JSON.stringify(next),
      // Keep legacy column in sync for older readers / ops.
      usePortfolioInMatching: next.portfolioProjects ? 1 : 0,
      updatedAt: nowIso(),
    })
    .where(and(await owned(settings), eq(settings.id, row.id)));

  return next;
}

/** @deprecated Prefer getMatchingSourcesConfig().portfolioProjects */
export async function getUsePortfolioInMatching(): Promise<boolean> {
  return (await getMatchingSourcesConfig()).portfolioProjects;
}

/** @deprecated Prefer setMatchingSourcesConfig({ portfolioProjects }) */
export async function setUsePortfolioInMatching(enabled: boolean) {
  await setMatchingSourcesConfig({ portfolioProjects: enabled });
}
