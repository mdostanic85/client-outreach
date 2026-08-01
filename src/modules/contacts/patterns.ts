/**
 * Email pattern suggestions for manual review only.
 * Never treat as verified; never auto-send.
 */

export type PatternSuggestion = {
  email: string;
  pattern: string;
  confidence: "pattern_unverified";
};

const GENERIC_LOCAL = new Set([
  "info",
  "hello",
  "contact",
  "hi",
  "team",
  "support",
  "office",
  "design",
  "jobs",
  "careers",
  "hr",
]);

function slugifyLocal(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function suggestEmailPatterns(input: {
  fullName: string;
  domain: string;
}): PatternSuggestion[] {
  const domain = input.domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .toLowerCase();
  if (!domain.includes(".")) return [];

  const parts = input.fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];

  const first = slugifyLocal(parts[0]);
  const last = slugifyLocal(parts[parts.length - 1]);
  if (!first || !last) return [];

  const candidates: Array<{ email: string; pattern: string }> = [
    { email: `${first}.${last}@${domain}`, pattern: "first.last" },
    { email: `${first}${last}@${domain}`, pattern: "firstlast" },
    { email: `${first[0]}${last}@${domain}`, pattern: "flast" },
    { email: `${first}@${domain}`, pattern: "first" },
  ];

  return candidates
    .filter((c) => !GENERIC_LOCAL.has(c.email.split("@")[0]!))
    .map((c) => ({
      ...c,
      confidence: "pattern_unverified" as const,
    }));
}

export function isGenericLocalPart(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return GENERIC_LOCAL.has(local);
}
