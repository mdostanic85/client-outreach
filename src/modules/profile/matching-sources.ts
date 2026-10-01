import { and, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources } from "@/db/schema";
import {
  MatchingSourcesConfigSchema,
  parseMatchingSourcesConfig,
  resolveMatchingSourcesForScoring as resolveMatchingSourcesForScoringCore,
  type MatchingSourcesConfig,
} from "./matching-sources-core";
import { owned } from "@/modules/auth/current-user";
import { getUserSettings, updateUserSettings } from "@/modules/settings/user-settings";

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
  const next = MatchingSourcesConfigSchema.parse({
    ...(await getMatchingSourcesConfig()),
    ...patch,
  });

  await updateUserSettings({
    matchingSourcesJson: JSON.stringify(next),
    // Keep legacy column in sync for older readers / ops.
    usePortfolioInMatching: next.portfolioProjects ? 1 : 0,
  });

  return next;
}
