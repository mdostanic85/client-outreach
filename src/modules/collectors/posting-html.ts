import * as cheerio from "cheerio";
import { extractDomain } from "@/modules/companies/identity";

/** Helpers for job boards that return the posting body as HTML. */

/** Visible text of a posting, whitespace collapsed and capped. */
export function postingText(html: string | undefined, maxChars: number): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, maxChars);
}

/** Links that never point at the employer's own site. */
const NON_COMPANY_HOSTS =
  /(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|notion\.so|google\.com)/i;

/**
 * Guess the employer's website from links in the posting: prefer a host that
 * shares a word with the company name, else the first non-social link.
 * `boardHost` excludes links back to the job board itself.
 */
export function companyDomainFromPosting(
  html: string | undefined,
  companyName: string,
  boardHost: RegExp,
): string | undefined {
  if (!html) return undefined;
  const $ = cheerio.load(html);
  const hrefs: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) hrefs.push(href);
  });

  const candidates = hrefs
    .map((h) => extractDomain(h))
    .filter((d): d is string => !!d && !boardHost.test(d) && !NON_COMPANY_HOSTS.test(d));
  if (candidates.length === 0) return undefined;

  const tokens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  return candidates.find((d) => tokens.some((t) => d.includes(t))) ?? candidates[0];
}

/** List fields some APIs send as an array, a keyed object or a single string. */
export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    );
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}
