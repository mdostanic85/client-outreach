import * as cheerio from "cheerio";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activities, companies, contacts, leads } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { resolveCountryPolicy } from "@/lib/policy/country";
import { retrievePage } from "@/lib/retrieval/fetch-page";
import { getLeadRecommendedRole } from "@/modules/leads/lifecycle";
import { extractPeopleFromTeamText, type ExtractedPerson } from "./extract-people";
import { isGenericLocalPart } from "./patterns";
import type { ContactConfidence } from "@/modules/contacts/confidence";

const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contacts",
  "/about",
  "/about-us",
  "/team",
  "/people",
  "/our-team",
  "/company",
];

const TEAM_PATHS = ["/team", "/people", "/our-team", "/about/team", "/company/team"];

export type HarvestedEmail = {
  email: string;
  name: string | null;
  role: string | null;
  sourceUrl: string;
  confidence: Extract<
    ContactConfidence,
    "published_personal" | "published_generic"
  >;
};

export type HarvestResult = {
  emails: HarvestedEmail[];
  teamPageText: string | null;
  teamPageUrl: string | null;
  pagesFetched: number;
  contactsCreated: number;
};

function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .toLowerCase();
}

function parseMailto(href: string): string | null {
  const raw = href.replace(/^mailto:/i, "").split("?")[0]?.trim() ?? "";
  const email = decodeURIComponent(raw).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function inferNameNearMailto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el: any,
): string | null {
  const linkText = $(el).text().replace(/\s+/g, " ").trim();
  if (linkText && !linkText.includes("@") && linkText.length < 80) {
    return linkText;
  }
  const parent = $(el).parent();
  const nearby = parent
    .find("h1,h2,h3,h4,.name,.person-name,[class*='name']")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (nearby && nearby.length < 80 && !nearby.includes("@")) return nearby;
  return null;
}

function harvestFromHtml(
  html: string,
  pageUrl: string,
  companyDomain: string,
): HarvestedEmail[] {
  const $ = cheerio.load(html);
  const found = new Map<string, HarvestedEmail>();

  $("a[href^='mailto:'], a[href^='MAILTO:']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const email = parseMailto(href);
    if (!email) return;
    const emailDomain = email.split("@")[1] ?? "";
    // Prefer same-domain addresses; still keep others labeled generic if obvious
    const sameDomain =
      emailDomain === companyDomain ||
      emailDomain.endsWith(`.${companyDomain}`);
    if (!sameDomain && !isGenericLocalPart(email)) {
      // Skip personal emails on other domains (e.g. gmail in footer widgets)
      if (
        /gmail\.com|yahoo\.|hotmail\.|outlook\.|icloud\./i.test(emailDomain)
      ) {
        return;
      }
    }
    const confidence: HarvestedEmail["confidence"] = isGenericLocalPart(email)
      ? "published_generic"
      : "published_personal";
    if (!found.has(email)) {
      found.set(email, {
        email,
        name: inferNameNearMailto($, el),
        role: null,
        sourceUrl: pageUrl,
        confidence,
      });
    }
  });

  // Structured contact hints: email-looking text near contact labels
  $("a, span, p, li, td").each((_, el) => {
    const text = $(el).text();
    const match = text.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    );
    if (!match) return;
    const email = match[1]!.toLowerCase();
    if (found.has(email)) return;
    const emailDomain = email.split("@")[1] ?? "";
    if (
      emailDomain !== companyDomain &&
      !emailDomain.endsWith(`.${companyDomain}`)
    ) {
      return;
    }
    found.set(email, {
      email,
      name: null,
      role: null,
      sourceUrl: pageUrl,
      confidence: isGenericLocalPart(email)
        ? "published_generic"
        : "published_personal",
    });
  });

  return [...found.values()];
}

async function fetchHtml(url: string): Promise<{
  html: string | null;
  finalUrl: string;
  text: string | null;
}> {
  // retrievePage extracts text; we need a parallel raw fetch for mailto
  const page = await retrievePage(url);
  if (page.status !== "ok") {
    return { html: null, finalUrl: url, text: null };
  }

  // Re-fetch body for mailto — small pages only; reuse SSRF via retrievePage gate
  try {
    const res = await fetch(page.finalUrl, {
      headers: {
        "User-Agent": "ClientOutreachBot/0.1 (+local; contact-harvest)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        html: null,
        finalUrl: page.finalUrl,
        text: page.extractedText,
      };
    }
    const html = await res.text();
    if (html.length > 1_500_000) {
      return {
        html: null,
        finalUrl: page.finalUrl,
        text: page.extractedText,
      };
    }
    return { html, finalUrl: page.finalUrl, text: page.extractedText };
  } catch {
    return {
      html: null,
      finalUrl: page.finalUrl,
      text: page.extractedText,
    };
  }
}

/**
 * Harvest published emails from company contact/team pages.
 * Only call after lead acceptance. Does not invent addresses.
 */
export async function harvestContactsForLead(leadId: string): Promise<HarvestResult> {
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");
  if (
    lead.state !== "accepted" &&
    lead.state !== "draft_ready" &&
    lead.state !== "sent" &&
    lead.state !== "follow_up_due"
  ) {
    throw new Error("Harvest only after lead acceptance");
  }

  const company = (await db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId)).limit(1))[0];
  if (!company?.domain) {
    throw new Error("Company domain required for contact harvest");
  }

  const domain = normalizeDomain(company.domain);
  const urls = [
    `https://${domain}/`,
    ...CONTACT_PATHS.map((p) => `https://${domain}${p}`),
  ];

  const allEmails: HarvestedEmail[] = [];
  let teamPageText: string | null = null;
  let teamPageUrl: string | null = null;
  let pagesFetched = 0;
  const seenUrls = new Set<string>();

  for (const url of urls) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const { html, finalUrl, text } = await fetchHtml(url);
    pagesFetched += 1;
    if (html) {
      allEmails.push(...harvestFromHtml(html, finalUrl, domain));
    }
    const isTeam = TEAM_PATHS.some((p) => finalUrl.toLowerCase().includes(p));
    if (isTeam && text && text.length > 100 && !teamPageText) {
      teamPageText = text.slice(0, 20_000);
      teamPageUrl = finalUrl;
    }
  }

  // Dedupe by email
  const byEmail = new Map<string, HarvestedEmail>();
  for (const e of allEmails) {
    if (!byEmail.has(e.email)) byEmail.set(e.email, e);
  }
  const unique = [...byEmail.values()];

  const existing = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, company.id));
  const existingEmails = new Set(
    existing.map((c) => c.email?.toLowerCase()).filter(Boolean),
  );

  let contactsCreated = 0;
  const now = nowIso();
  const { policy } = await resolveCountryPolicy(company.country);
  for (const e of unique) {
    if (existingEmails.has(e.email)) continue;
    await db.insert(contacts)
      .values({
        id: newId("ct"),
        companyId: company.id,
        name: e.name,
        role: e.role,
        email: e.email,
        confidence: e.confidence,
        sourceUrl: e.sourceUrl,
        businessRelevance: "Published on company website",
        lawfulBasisNote:
          "Publicly published business contact; country policy recorded at harvest",
        countryPolicyApplied: policy,
        manuallyConfirmed: false,
        createdAt: now,
      });
    contactsCreated += 1;
    existingEmails.add(e.email);
  }

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "contacts_harvested",
      metadataJson: JSON.stringify({
        pagesFetched,
        emailsFound: unique.length,
        contactsCreated,
        teamPageUrl,
      }),
      occurredAt: now,
    });

  logger.info(
    { leadId, pagesFetched, contactsCreated, emails: unique.length },
    "Contact harvest complete",
  );

  return {
    emails: unique,
    teamPageText,
    teamPageUrl,
    pagesFetched,
    contactsCreated,
  };
}

/**
 * Full harvest for a lead: published emails first, then names and roles read
 * from the team page. People come back as hints only; no address is guessed.
 */
export async function harvestLeadContacts(leadId: string): Promise<{
  contactsCreated: number;
  emailsFound: number;
  people: Array<{ name: string; role: string | null }>;
}> {
  const harvest = await harvestContactsForLead(leadId);
  let people: ExtractedPerson[] = [];
  if (harvest.teamPageText && harvest.teamPageUrl) {
    people = await extractPeopleFromTeamText({
      leadId,
      pageUrl: harvest.teamPageUrl,
      pageText: harvest.teamPageText,
      recommendedRole: await getLeadRecommendedRole(leadId),
    });
  }
  return {
    contactsCreated: harvest.contactsCreated,
    emailsFound: harvest.emails.length,
    people: people.slice(0, 10).map(({ name, role }) => ({ name, role })),
  };
}
