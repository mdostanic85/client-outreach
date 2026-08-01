/**
 * Suggested lookup links — no scraping / no LinkedIn automation.
 * Helps manual contact resolution after lead acceptance.
 */

export type LookupLinks = {
  teamPage: string;
  contactPage: string;
  linkedInCompany: string;
  webSearch: string;
};

export function buildLookupLinks(input: {
  companyName: string;
  domain?: string | null;
}): LookupLinks {
  const domain = (input.domain ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const base = domain ? `https://${domain}` : null;
  const q = encodeURIComponent(input.companyName);

  return {
    teamPage: base ? `${base}/team` : `https://www.google.com/search?q=${q}+team`,
    contactPage: base
      ? `${base}/contact`
      : `https://www.google.com/search?q=${q}+contact`,
    linkedInCompany: `https://www.google.com/search?q=${encodeURIComponent(
      `site:linkedin.com/company ${input.companyName}`,
    )}`,
    webSearch: `https://www.google.com/search?q=${encodeURIComponent(
      `${input.companyName}${domain ? ` ${domain}` : ""} email OR contact OR team`,
    )}`,
  };
}
