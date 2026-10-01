import type { RawCollectedJob } from "@/modules/collectors/types";
import { normalizeTitle } from "@/modules/occupations/search";
import type { JobSearchParams } from "@/modules/search-profile/schemas";

/**
 * AI scoring has a per-run budget, so the order of kept jobs decides which
 * ones get a score and can reach Today. Best title matches go first, fresher
 * before older, and sources take turns so one large careers board can't use
 * up the whole budget.
 */

function titleStrength(title: string, params: JobSearchParams): number {
  const t = normalizeTitle(title);
  const targets = params.targetTitles.map(normalizeTitle).filter(Boolean);
  const synonyms = params.titleSynonyms.map(normalizeTitle).filter(Boolean);
  if (targets.some((target) => t === target)) return 3;
  if (targets.some((target) => t.includes(target))) return 2;
  if (synonyms.some((synonym) => t === synonym || t.includes(synonym))) return 1;
  return 0;
}

function postedTime(job: RawCollectedJob): number {
  const time = job.postedAt ? Date.parse(job.postedAt) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

export function rankForEvaluation(
  jobs: readonly RawCollectedJob[],
  params: JobSearchParams,
): RawCollectedJob[] {
  const bySource = new Map<string, RawCollectedJob[]>();
  for (const job of jobs) {
    const list = bySource.get(job.source) ?? [];
    list.push(job);
    bySource.set(job.source, list);
  }
  const queues = [...bySource.values()].map((list) =>
    [...list].sort(
      (a, b) =>
        titleStrength(b.title, params) - titleStrength(a.title, params) ||
        postedTime(b) - postedTime(a),
    ),
  );
  // Sources with the strongest first job lead each round.
  queues.sort((a, b) => titleStrength(b[0]!.title, params) - titleStrength(a[0]!.title, params));

  const ordered: RawCollectedJob[] = [];
  for (let round = 0; ordered.length < jobs.length; round += 1) {
    for (const queue of queues) {
      const job = queue[round];
      if (job) ordered.push(job);
    }
  }
  return ordered;
}
