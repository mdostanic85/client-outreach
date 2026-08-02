import { eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources, settings } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import {
  MatchingSourcesConfigSchema,
  parseMatchingSourcesConfig,
  resolveMatchingSourcesForScoring as resolveMatchingSourcesForScoringCore,
  type MatchingSourcesConfig,
} from "./matching-sources-core";

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

export function getMatchingSourcesConfig(): MatchingSourcesConfig {
  const row = getDb().select().from(settings).all()[0];
  return parseMatchingSourcesConfig(
    row?.matchingSourcesJson,
    row?.usePortfolioInMatching,
  );
}

/**
 * Combine category toggles with per-source enabledForMatching flags.
 * Loads sources from the DB when not provided.
 */
export function resolveMatchingSourcesForScoring(
  config: MatchingSourcesConfig = getMatchingSourcesConfig(),
  sources?: Array<{ type: string; enabledForMatching: number | boolean }>,
): MatchingSourcesConfig {
  const list =
    sources ??
    getDb()
      .select()
      .from(profileSources)
      .where(isNull(profileSources.deletedAt))
      .all()
      .map((s) => ({
        type: s.type,
        enabledForMatching: s.enabledForMatching,
      }));

  return resolveMatchingSourcesForScoringCore(config, list);
}

export function setMatchingSourcesConfig(
  patch: Partial<MatchingSourcesConfig>,
): MatchingSourcesConfig {
  const db = getDb();
  const row = db.select().from(settings).all()[0];
  if (!row) throw new Error("Settings missing");

  const next = MatchingSourcesConfigSchema.parse({
    ...getMatchingSourcesConfig(),
    ...patch,
  });

  db.update(settings)
    .set({
      matchingSourcesJson: JSON.stringify(next),
      // Keep legacy column in sync for older readers / ops.
      usePortfolioInMatching: next.portfolioProjects ? 1 : 0,
      updatedAt: nowIso(),
    })
    .where(eq(settings.id, row.id))
    .run();

  return next;
}

/** @deprecated Prefer getMatchingSourcesConfig().portfolioProjects */
export function getUsePortfolioInMatching(): boolean {
  return getMatchingSourcesConfig().portfolioProjects;
}

/** @deprecated Prefer setMatchingSourcesConfig({ portfolioProjects }) */
export function setUsePortfolioInMatching(enabled: boolean) {
  setMatchingSourcesConfig({ portfolioProjects: enabled });
}
