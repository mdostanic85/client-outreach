/** Simple token-level edit ratio for draft learning signals. */
export function editRatio(before: string, after: string): number {
  if (before === after) return 0;
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length === 0 && b.length === 0) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;

  const counts = new Map<string, number>();
  for (const t of a) counts.set(t, (counts.get(t) ?? 0) + 1);
  let common = 0;
  for (const t of b) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      common += 1;
      counts.set(t, c - 1);
    }
  }
  const changed = maxLen - common;
  return Math.min(1, changed / maxLen);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\w'@.-]/g, ""))
    .filter(Boolean);
}
