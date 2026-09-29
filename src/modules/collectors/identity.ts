/** Strip attribution only. Keep requisition/query IDs and meaningful path casing. */
export function canonicalJobUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|gh_src|lever-source|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.href;
  } catch { return null; }
}

export function jobIdentityKeys(job: { source: string; externalId: string; sourceUrl: string }): string[] {
  const url = canonicalJobUrl(job.sourceUrl);
  return [`source:${job.source}:${job.externalId}`, ...(url ? [`url:${url}`] : [])];
}
