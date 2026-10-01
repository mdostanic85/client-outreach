/**
 * How a company is recognised across sources: the bare host of its website
 * and a name with legal suffixes and punctuation removed. Used by job
 * collection and by client-outreach discovery alike.
 */

export function extractDomain(urlOrHost?: string | null): string | undefined {
  if (!urlOrHost) return undefined;
  try {
    const withProtocol = urlOrHost.includes("://")
      ? urlOrHost
      : `https://${urlOrHost}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(inc|llc|ltd|gmbh|ag|sa|bv|plc|corp|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
