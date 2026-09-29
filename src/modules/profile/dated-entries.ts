import type { StructuredProfile } from "./schemas";

/** A CV line that opens with a year or date range, e.g. "2019–2023 ⇥ Quantox ⇥ Senior UI/UX Designer". */
export type DatedEntry = { line: string; label: string };

const MONTH = "(?:[A-Za-z]{3,9}\\.?\\s+)?";
const YEAR = "(?:19|20)\\d{2}";
const END = `(?:${MONTH}${YEAR}|present|current|now|today|ongoing)`;
const DATED_LINE = new RegExp(
  `^\\s*${MONTH}${YEAR}(?:\\s*(?:[–—-]|to)\\s*${END})?\\b[\\s\\t:|·,-]*(.*)$`,
  "i",
);

const STOP = new Set(["and", "the", "for", "with", "from", "senior", "junior", "lead", "present"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
}

/**
 * Dated entries in the source text. When the date sits on its own line
 * (LinkedIn exports), the line above names the entry.
 */
export function findDatedEntries(corpus: string): DatedEntry[] {
  const lines = corpus.split("\n");
  const out: DatedEntry[] = [];
  let previous = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(DATED_LINE);
    if (match) {
      const rest = (match[1] ?? "").trim();
      // First cell after the date is the organization in column layouts.
      const label = (rest.split("\t")[0] || previous).trim();
      if (label && tokens(label).length > 0) out.push({ line: line.replace(/\t+/g, " · "), label });
    }
    previous = line;
  }
  return out;
}

/** Entries whose label is not reflected anywhere in the extracted roles, education or certifications. */
export function missingDatedEntries(
  profile: StructuredProfile,
  corpus: string,
): DatedEntry[] {
  const haystack = [
    ...profile.relevantProjects.flatMap((p) => [p.title, p.organization ?? "", p.role ?? ""]),
    ...profile.education,
    ...profile.certifications,
  ]
    .join(" ")
    .toLowerCase();
  const have = new Set(tokens(haystack));
  return findDatedEntries(corpus).filter(
    (entry) => !tokens(entry.label).some((t) => have.has(t)),
  );
}
