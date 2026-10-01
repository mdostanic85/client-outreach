import { normalizeTitle } from "@/modules/occupations/search";
import type { HomeAccess } from "./work-location";

/**
 * A fast, deterministic score for a job the AI has not scored, so every job
 * in the list shows a number. It reads only the title, the posting text and
 * the work location. It is capped below the "Strong match" bar: only the AI
 * evaluation, which reads the whole profile, can say a job is a strong fit.
 */

/** Highest score an estimate can reach (below `STRONG_MATCH_MIN`). */
export const ESTIMATE_MAX = 69;

export type EstimateJob = {
  title: string;
  description?: string | null;
};

export type EstimateCriteria = {
  targetTitles: readonly string[];
  titleSynonyms: readonly string[];
  /** Skills and keywords from the search criteria. */
  skills: readonly string[];
  seniority: readonly string[];
};

export type JobEstimate = {
  score: number;
  /** One line on what the number rests on, for the tooltip. */
  basis: string;
};

const LEVEL_WORDS: Record<string, RegExp> = {
  junior: /\b(junior|jr|intern|trainee|entry)\b/i,
  mid: /\b(mid|medior|intermediate)\b/i,
  senior: /\b(senior|sr)\b/i,
  lead: /\b(lead|principal|staff|head|director|manager)\b/i,
};

function levelOf(text: string): string | null {
  for (const [level, pattern] of Object.entries(LEVEL_WORDS)) {
    if (pattern.test(text)) return level;
  }
  return null;
}

function titleScore(title: string, criteria: EstimateCriteria): { points: number; label: string } {
  const t = normalizeTitle(title);
  const targets = criteria.targetTitles.map(normalizeTitle).filter(Boolean);
  const synonyms = criteria.titleSynonyms.map(normalizeTitle).filter(Boolean);
  if (targets.some((target) => t === target)) return { points: 55, label: "same title" };
  if (targets.some((target) => t.includes(target))) return { points: 48, label: "title contains yours" };
  if (synonyms.some((s) => t === s || t.includes(s))) return { points: 40, label: "similar title" };
  const words = new Set(t.split(/\s+/).filter((w) => w.length > 2));
  const overlap = [...targets, ...synonyms].some((needle) => {
    const tokens = needle.split(/\s+/).filter((w) => w.length > 2);
    return tokens.length > 0 && tokens.filter((tok) => words.has(tok)).length >= Math.min(2, tokens.length);
  });
  return overlap ? { points: 28, label: "related title" } : { points: 12, label: "loosely related" };
}

function skillScore(job: EstimateJob, criteria: EstimateCriteria): { points: number; hits: number; of: number } {
  const skills = [...new Set(criteria.skills.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 1))];
  if (skills.length === 0) return { points: 12, hits: 0, of: 0 };
  const text = `${job.title} ${job.description ?? ""}`.toLowerCase();
  const hits = skills.filter((skill) => text.includes(skill)).length;
  return { points: Math.round((hits / skills.length) * 25), hits, of: skills.length };
}

function levelScore(title: string, criteria: EstimateCriteria): number {
  const wanted = criteria.seniority.map((s) => levelOf(s)).filter((l): l is string => Boolean(l));
  const found = levelOf(title);
  if (wanted.length === 0 || !found) return 5;
  return wanted.includes(found) ? 10 : 0;
}

export function estimateJobScore(
  job: EstimateJob,
  criteria: EstimateCriteria,
  home: HomeAccess,
): JobEstimate {
  const title = titleScore(job.title, criteria);
  const skills = skillScore(job, criteria);
  const level = levelScore(job.title, criteria);
  const place = home === "ok" ? 10 : home === "unclear" ? 4 : 0;
  const score = Math.min(ESTIMATE_MAX, Math.max(5, title.points + skills.points + level + place));
  const parts = [title.label];
  if (skills.of > 0) parts.push(`${skills.hits} of ${skills.of} skills mentioned`);
  if (home === "unclear") parts.push("work location unclear");
  return { score, basis: parts.join(" · ") };
}
