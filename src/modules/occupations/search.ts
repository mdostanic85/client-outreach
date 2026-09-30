import { OCCUPATIONS, type Occupation } from "./catalog";
import type { OccupationFamily } from "./families";

/** Lowercase, strip diacritics (č ć š ž đ → c c s z dj) and punctuation. */
export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Level words carry no information about the occupation itself. */
const LEVEL_WORDS =
  /\b(senior|sr|junior|jr|mid|medior|lead|staff|principal|head of|chief|glavni|visi|visa|mladji|mladja|samostalni|samostalna|stariji|starija)\b/g;

function coreTitle(value: string): string {
  return normalizeTitle(value).replace(LEVEL_WORDS, " ").replace(/\s+/g, " ").trim();
}

function names(occ: Occupation): string[] {
  return [occ.en, occ.sr, ...occ.synonyms];
}

type Indexed = { occ: Occupation; keys: string[] };

const INDEX: Indexed[] = OCCUPATIONS.map((occ) => ({
  occ,
  keys: names(occ).map(normalizeTitle),
}));

function rank(key: string, query: string): number {
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  if (key.split(" ").some((word) => word.startsWith(query))) return 2;
  if (key.includes(query)) return 3;
  return Number.POSITIVE_INFINITY;
}

/** Autocomplete over English and Serbian names and synonyms. */
export function searchOccupations(query: string, limit = 8): Occupation[] {
  const q = normalizeTitle(query);
  if (q.length < 2) return [];
  const scored: Array<{ occ: Occupation; score: number }> = [];
  for (const { occ, keys } of INDEX) {
    const best = Math.min(...keys.map((key) => rank(key, q)));
    if (Number.isFinite(best)) scored.push({ occ, score: best });
  }
  scored.sort((a, b) => a.score - b.score || a.occ.en.localeCompare(b.occ.en));
  return scored.slice(0, limit).map((s) => s.occ);
}

/**
 * Exact name or synonym match, ignoring level words ("Senior Accountant" →
 * accountant). Returns null for titles we don't know.
 */
export function findOccupation(title: string | null | undefined): Occupation | null {
  if (!title?.trim()) return null;
  const full = normalizeTitle(title);
  const core = coreTitle(title);
  for (const { occ, keys } of INDEX) {
    if (keys.includes(full) || keys.includes(core)) return occ;
  }
  return null;
}

/** Family of the first title we recognize, for profiles saved before families existed. */
export function inferFamily(titles: Array<string | null | undefined>): OccupationFamily | null {
  for (const title of titles) {
    const occ = findOccupation(title);
    if (occ) return occ.family;
  }
  return null;
}

/**
 * Every way a posting may name this job, English first then Serbian, for
 * search queries and title filtering.
 */
export function occupationSearchTerms(occ: Occupation): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names(occ)) {
    const key = normalizeTitle(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** The family we act on: explicit from the survey, else inferred from titles. */
export function resolveFamily(profile: {
  occupationFamily?: OccupationFamily;
  targetRoles?: string[];
  currentRole?: string;
} | null | undefined): OccupationFamily | null {
  if (!profile) return null;
  return (
    profile.occupationFamily ??
    inferFamily([...(profile.targetRoles ?? []), profile.currentRole])
  );
}
