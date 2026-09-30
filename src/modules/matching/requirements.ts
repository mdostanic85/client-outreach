/**
 * Hard requirements we can check without the model: driving licence
 * categories and ADR. A posting that requires a licence the person doesn't
 * hold is not a match, however good the rest looks (plan phase 4).
 */

const CATEGORIES = ["C1E", "BE", "CE", "C1", "DE", "D1", "B", "C", "D"] as const;
type Category = (typeof CATEGORIES)[number];

/** Holding a category also covers the ones below it. */
const IMPLIES: Record<Category, Category[]> = {
  B: [],
  BE: ["B"],
  C1: ["B"],
  C1E: ["C1", "B", "BE"],
  C: ["C1", "B"],
  CE: ["C", "C1", "C1E", "B", "BE"],
  D1: ["B"],
  DE: ["D", "D1", "B", "BE"],
  D: ["D1", "B"],
};

const CAT = "(C1E|BE|CE|C1|DE|D1|B|C|D)";
const LIST = `${CAT}(?:\\s*(?:,|/|\\+|i|ili|or|and)\\s*${CAT})*`;
/** "C kategorije", "CE category", "C licence", "C dozvola". */
const CAT_BEFORE_WORD = new RegExp(
  `(?<![\\p{L}\\p{N}])(${LIST})\\s+(?:[Kk]ategorij|[Cc]ategor|[Ll]icen[cs]|[Dd]ozvol)`,
  "gu",
);
/** "kategorije C", "category CE", "vozačka dozvola C/CE". */
const WORD_BEFORE_CAT = new RegExp(
  `(?:[Kk]ategorij\\p{L}*|[Cc]ategor\\p{L}*|[Dd]ozvol\\p{L}*|[Ll]icen[cs]\\p{L}*)\\s*[:\\-]?\\s*(${LIST})(?![\\p{L}\\p{N}])`,
  "gu",
);
const OPTIONAL_NEARBY = /prednost|po[žz]eljn|advantage|nice to have|\bplus\b|preferred|desirable/i;
const REQUIRED_NEARBY = /obavezn|neophodn|uslov|required|must|mandatory|essential/i;

/** Whole tokens only, so the C in "Professional" is never a category. */
function categoriesIn(text: string): Category[] {
  return text
    .split(/[^A-Za-z0-9]+/)
    .filter((token): token is Category => (CATEGORIES as readonly string[]).includes(token));
}

function held(licences: string[]): Set<Category> {
  const out = new Set<Category>();
  for (const line of licences) {
    for (const cat of categoriesIn(line.toUpperCase())) {
      out.add(cat);
      IMPLIES[cat].forEach((c) => out.add(c));
    }
  }
  return out;
}

function context(text: string, index: number, length: number): string {
  return text.slice(Math.max(0, index - 80), index + length + 80);
}

/** Groups of alternatives the posting requires ("C ili CE" = one group). */
export function requiredLicenceGroups(title: string, description: string): Category[][] {
  const groups: Category[][] = [];
  const scan = (text: string, fromTitle: boolean) => {
    for (const re of [CAT_BEFORE_WORD, WORD_BEFORE_CAT]) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const cats = categoriesIn(m[1] ?? "");
        if (!cats.length) continue;
        if (!fromTitle && OPTIONAL_NEARBY.test(context(text, m.index ?? 0, m[0].length))) continue;
        groups.push(cats);
      }
    }
  };
  scan(title, true);
  scan(description.slice(0, 6000), false);
  return groups;
}

function requiresAdr(title: string, description: string): boolean {
  if (/\bADR\b/.test(title)) return true;
  const text = description.slice(0, 6000);
  for (const m of text.matchAll(/\bADR\b/g)) {
    const around = context(text, m.index ?? 0, 3);
    if (REQUIRED_NEARBY.test(around) && !OPTIONAL_NEARBY.test(around)) return true;
  }
  return false;
}

/**
 * Required licences the person clearly lacks. Returns [] when the profile
 * lists no licences at all — then we can't know, and the model decides.
 */
export function missingMandatoryLicences(input: {
  title: string;
  description: string;
  licences: string[];
}): string[] {
  if (input.licences.length === 0) return [];
  const have = held(input.licences);
  const missing: string[] = [];
  for (const group of requiredLicenceGroups(input.title, input.description)) {
    if (!group.some((cat) => have.has(cat))) {
      missing.push(`Driving licence ${group.join("/")}`);
    }
  }
  if (
    requiresAdr(input.title, input.description) &&
    !input.licences.some((l) => /\bADR\b/i.test(l))
  ) {
    missing.push("ADR certificate");
  }
  return [...new Set(missing)];
}
