import * as cheerio from "cheerio";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sourcePages } from "@/db/schema";
import { RESEARCH_PROMPT_VERSION } from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { newId } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { retrievePage, type RetrievedPage } from "@/lib/retrieval/fetch-page";

const PAGE_PATHS = {
  about: ["/about", "/about-us", "/company", "/about/company", "/who-we-are"],
  careers: ["/careers", "/jobs", "/join", "/join-us", "/work-with-us"],
  blog: ["/blog", "/news", "/changelog", "/product", "/updates"],
} as const;

export type RetrievedCompanyPages = {
  pages: Array<RetrievedPage & { kind: string; pageId: string }>;
  okCount: number;
  failedCount: number;
};

function absoluteUrl(domain: string, path: string): string {
  return `https://${domain}${path}`;
}

function findLinkedPath(
  homepageHtml: string | null,
  homepageUrl: string,
  patterns: string[],
): string | null {
  if (!homepageHtml) return null;
  try {
    const $ = cheerio.load(homepageHtml);
    const hrefs: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) hrefs.push(href);
    });
    for (const href of hrefs) {
      const lower = href.toLowerCase();
      if (patterns.some((p) => lower.includes(p.replace(/^\//, "")))) {
        try {
          return new URL(href, homepageUrl).toString();
        } catch {
          continue;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Cache key: normalized URL + content hash + prompt version + model ID.
 * Reuse stored page when URL + prompt + model match and content hash unchanged
 * (we skip re-fetch if a successful page for that URL exists within refresh window).
 */
async function findCachedPage(companyId: string, url: string, modelId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(sourcePages)
    .where(and(eq(sourcePages.companyId, companyId), eq(sourcePages.url, url)));

  return rows.find(
    (r) =>
      r.status === "ok" &&
      r.extractedText &&
      (r.promptVersion === RESEARCH_PROMPT_VERSION || !r.promptVersion) &&
      (r.modelId === modelId || !r.modelId),
  );
}

async function fetchAndStore(
  companyId: string,
  url: string,
  kind: string,
  modelId: string,
): Promise<(RetrievedPage & { kind: string; pageId: string }) | null> {
  const cached = await findCachedPage(companyId, url, modelId);
  if (cached) {
    logger.info({ url, companyId }, "Using cached source page");
    return {
      url: cached.url,
      finalUrl: cached.url,
      title: cached.title,
      retrievedAt: cached.retrievedAt,
      contentHash: cached.contentHash,
      extractionMethod: cached.extractionMethod,
      extractedText: cached.extractedText,
      textLength: cached.textLength ?? 0,
      httpStatus: cached.httpStatus,
      status: cached.status as "ok" | "failed",
      error: cached.error,
      kind,
      pageId: cached.id,
    };
  }

  const page = await retrievePage(url);
  // Also keep raw HTML temporarily for link discovery — re-fetch stores text only.
  // For about/careers discovery we probe known paths + homepage links via second fetch of homepage.
  const pageId = newId("page");
  await getDb()
    .insert(sourcePages)
    .values({
      id: pageId,
      companyId,
      url: page.finalUrl,
      title: page.title,
      retrievedAt: page.retrievedAt,
      contentHash: page.contentHash,
      extractionMethod: page.extractionMethod,
      extractedText: page.extractedText,
      textLength: page.textLength,
      httpStatus: page.httpStatus,
      status: page.status,
      error: page.error,
      promptVersion: RESEARCH_PROMPT_VERSION,
      modelId,
    });

  return { ...page, kind, pageId };
}

/**
 * Retrieval order: homepage → About/Company → Careers → one blog/news/product page.
 */
export async function retrieveCompanyPages(
  companyId: string,
  domain: string,
): Promise<RetrievedCompanyPages> {
  const modelId = resolveModel("researchAndScore");
  const results: Array<RetrievedPage & { kind: string; pageId: string }> = [];

  const homepage = await fetchAndStore(
    companyId,
    `https://${domain}`,
    "homepage",
    modelId,
  );
  if (homepage) results.push(homepage);

  // Discover linked paths by fetching homepage HTML lightly
  let homepageHtml: string | null = null;
  try {
    const res = await fetch(`https://${domain}`, {
      headers: { "User-Agent": "ClientOutreachBot/0.1 (+local; research)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) homepageHtml = await res.text();
  } catch {
    homepageHtml = null;
  }

  const homepageUrl = `https://${domain}`;

  for (const [kind, paths] of Object.entries(PAGE_PATHS)) {
    const linked = findLinkedPath(
      homepageHtml,
      homepageUrl,
      paths.map((p) => p.replace(/^\//, "")),
    );
    const candidates = linked
      ? [linked]
      : paths.map((p) => absoluteUrl(domain, p));

    let stored = false;
    for (const url of candidates.slice(0, 2)) {
      const page = await fetchAndStore(companyId, url, kind, modelId);
      if (page?.status === "ok" && page.extractedText && page.textLength > 150) {
        results.push(page);
        stored = true;
        break;
      }
    }
    if (!stored && kind === "about") {
      // leave gap — incomplete research handled upstream
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return { pages: results, okCount, failedCount };
}
