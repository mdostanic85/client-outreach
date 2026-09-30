import * as cheerio from "cheerio";

/** Rate limit, auth wall or anti-bot response: stop this source for the current run. */
export class SourceBlockedError extends Error {
  constructor(readonly source: string, readonly status: number) {
    super(`${source} blocked the request (HTTP ${status}); retry on the next scheduled run`);
    this.name = "SourceBlockedError";
  }
}

export type CollectorDeps = {
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

/** Honest identifier for boards whose robots.txt allows listing pages. */
export const OPTRA_USER_AGENT = "OptraJobCollector/0.2 (+https://dostanic.net; personal job search, low volume)";
/** LinkedIn's guest endpoints serve an auth wall to non-browser agents. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function jitterMs(minMs: number, maxMs: number): number {
  return Math.round(minMs + Math.random() * Math.max(0, maxMs - minMs));
}

/**
 * GET one page. Redirects are never followed: they are either an auth wall or a
 * URL we did not build ourselves. 429/999/3xx surface as SourceBlockedError.
 */
export async function fetchPage(url: string, options: {
  source: string;
  userAgent: string;
  fetcher?: typeof fetch;
  accept?: string;
  method?: "GET" | "POST";
  body?: URLSearchParams;
}): Promise<string> {
  const res = await (options.fetcher ?? fetch)(url, {
    method: options.method ?? "GET",
    headers: {
      "User-Agent": options.userAgent,
      Accept: options.accept ?? "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,sr;q=0.8",
      ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: options.body?.toString(),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429 || res.status === 999 || (res.status >= 300 && res.status < 400)) {
    throw new SourceBlockedError(options.source, res.status);
  }
  if (!res.ok) throw new Error(`${options.source} HTTP ${res.status}`);
  return res.text();
}

/**
 * Walk search terms × pages under one request cap. A term stops when a page is
 * short or adds nothing new; a block keeps what was already found.
 */
export async function walkListing<C extends { id: string }>(options: {
  terms: string[];
  maxPages: number;
  maxRequests: number;
  delayMs: [number, number];
  sleep: (ms: number) => Promise<void>;
  loadPage: (term: string, pageIndex: number) => Promise<{ cards: C[]; last: boolean }>;
}): Promise<{ cards: Map<string, C>; blocked: boolean }> {
  const cards = new Map<string, C>();
  let requests = 0;
  try {
    for (const term of options.terms) {
      for (let page = 0; page < options.maxPages && requests < options.maxRequests; page++) {
        if (requests++ > 0) await options.sleep(jitterMs(...options.delayMs));
        const { cards: found, last } = await options.loadPage(term, page);
        const before = cards.size;
        for (const card of found) cards.set(card.id, card);
        if (last || cards.size === before) break;
      }
    }
  } catch (err) {
    if (!(err instanceof SourceBlockedError) || cards.size === 0) throw err;
    return { cards, blocked: true };
  }
  return { cards, blocked: false };
}

/** Fetch posting pages one by one with pauses; stop at the first block, skip single failures. */
export async function loadDetails<T, R>(items: T[], options: {
  delayMs: [number, number];
  sleep: (ms: number) => Promise<void>;
  load: (item: T) => Promise<R | null>;
}): Promise<{ results: R[]; blocked: boolean }> {
  const results: R[] = [];
  for (const item of items) {
    await options.sleep(jitterMs(...options.delayMs));
    try {
      const result = await options.load(item);
      if (result) results.push(result);
    } catch (err) {
      if (err instanceof SourceBlockedError) return { results, blocked: true };
    }
  }
  return { results, blocked: false };
}

/** HTML fragment → readable plain text with block boundaries preserved. */
export function htmlToText(html: string | null | undefined, max = 24000): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  $("script, style").remove();
  $("p, br, li, div, h1, h2, h3, h4, tr").prepend(" ");
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, max);
}

export function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // Serbian boards use dd.mm.yyyy.
  const sr = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(value.trim());
  const parsed = sr ? Date.UTC(Number(sr[3]), Number(sr[2]) - 1, Number(sr[1])) : Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}
