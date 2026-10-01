/** Multi-line text fields that hold one item per line. */

export function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listToLines(value: readonly string[] | undefined): string {
  return (value ?? []).join("\n");
}
