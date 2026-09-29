import { createHash } from "node:crypto";
import { isBlockedUrl } from "@/lib/security/ssrf";
import { logger } from "@/lib/logging/logger";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 15_000;

export type RetrievedPage = {
  url: string;
  finalUrl: string;
  title: string | null;
  retrievedAt: string;
  contentHash: string | null;
  extractionMethod: string | null;
  extractedText: string | null;
  textLength: number;
  httpStatus: number | null;
  status: "ok" | "failed";
  error: string | null;
  /** Absolute same-origin links found on the page (for site crawls). */
  links?: string[];
};

const MAX_REDIRECTS = 5;

/** Follows redirects by hand so every hop passes the SSRF check, not just the first URL. */
async function fetchChecked(url: string, signal: AbortSignal): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const blocked = await isBlockedUrl(current);
    if (blocked) throw new Error(blocked);
    const res = await fetch(current, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": "ClientOutreachBot/0.1 (+local; research)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    Object.defineProperty(res, "url", { value: current });
    return res;
  }
  throw new Error("Too many redirects");
}

function sameOriginLinks(html: string, baseUrl: string, cheerio: typeof import("cheerio")): string[] {
  const origin = new URL(baseUrl).origin;
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.origin !== origin) return;
      abs.hash = "";
      out.add(abs.toString());
    } catch {
      // ignore malformed hrefs
    }
  });
  return [...out];
}

export async function retrievePage(url: string): Promise<RetrievedPage> {
  const retrievedAt = new Date().toISOString();

  const blocked = await isBlockedUrl(url);
  if (blocked) {
    return {
      url,
      finalUrl: url,
      title: null,
      retrievedAt,
      contentHash: null,
      extractionMethod: null,
      extractedText: null,
      textLength: 0,
      httpStatus: null,
      status: "failed",
      error: blocked,
      links: [],
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetchChecked(url, controller.signal);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        url,
        finalUrl: res.url,
        title: null,
        retrievedAt,
        contentHash: null,
        extractionMethod: null,
        extractedText: null,
        textLength: 0,
        httpStatus: res.status,
        status: "failed",
        error: `Unsupported content-type: ${contentType}`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return {
        url,
        finalUrl: res.url,
        title: null,
        retrievedAt,
        contentHash: null,
        extractionMethod: null,
        extractedText: null,
        textLength: 0,
        httpStatus: res.status,
        status: "failed",
        error: `Response too large: ${buf.byteLength} bytes`,
        links: [],
      };
    }

    if (!res.ok) {
      return {
        url,
        finalUrl: res.url,
        title: null,
        retrievedAt,
        contentHash: null,
        extractionMethod: null,
        extractedText: null,
        textLength: 0,
        httpStatus: res.status,
        status: "failed",
        error: `HTTP ${res.status}`,
        links: [],
      };
    }

    const html = buf.toString("utf8");
    const extracted = await extractText(html, res.url);
    const links = sameOriginLinks(html, res.url, await import("cheerio"));
    const contentHash = createHash("sha256").update(extracted.text).digest("hex");

    return {
      url,
      finalUrl: res.url,
      title: extracted.title,
      retrievedAt,
      contentHash,
      extractionMethod: extracted.method,
      extractedText: extracted.text.slice(0, 40_000),
      textLength: extracted.text.length,
      httpStatus: res.status,
      status: "ok",
      error: null,
      links,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ url, err: message }, "Page retrieval failed");
    return {
      url,
      finalUrl: url,
      title: null,
      retrievedAt,
      contentHash: null,
      extractionMethod: null,
      extractedText: null,
      textLength: 0,
      httpStatus: null,
      status: "failed",
      error: message,
      links: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function extractTextWithCheerio(html: string): Promise<{
  title: string | null;
  text: string;
  method: string;
}> {
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, iframe").remove();
  const title = $("title").first().text().trim() || null;
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { title, text, method: "cheerio" };
}

async function extractText(
  html: string,
  url: string,
): Promise<{ title: string | null; text: string; method: string }> {
  try {
    const [{ JSDOM }, { Readability }] = await Promise.all([
      import("jsdom"),
      import("@mozilla/readability"),
    ]);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article?.textContent && article.textContent.trim().length > 200) {
      return {
        title: article.title ?? null,
        text: article.textContent.replace(/\s+/g, " ").trim(),
        method: "readability",
      };
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Readability/jsdom extract failed — falling back to cheerio",
    );
  }

  return extractTextWithCheerio(html);
}
