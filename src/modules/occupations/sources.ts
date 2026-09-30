import type { JobSource } from "@/modules/search-profile/schemas";
import { familyProfile, type OccupationFamily } from "./families";

/**
 * Public career boards of companies that hire across tech and business roles
 * (engineering, design, sales, marketing, finance). Only scanned for families
 * that use them.
 */
export const TECH_BUSINESS_ATS_BOARD_URLS = [
  "https://boards.greenhouse.io/figma",
  "https://jobs.ashbyhq.com/notion",
  "https://boards.greenhouse.io/stripe",
  "https://boards.greenhouse.io/discord",
  "https://boards.greenhouse.io/webflow",
  "https://boards.greenhouse.io/intercom",
  "https://boards.greenhouse.io/airbnb",
  "https://jobs.ashbyhq.com/linear",
  "https://jobs.ashbyhq.com/ramp",
  "https://boards.greenhouse.io/vercel",
];

const ATS_SOURCES: JobSource[] = ["greenhouse", "lever", "ashby"];

export function mentionsSerbia(locations: string[]): boolean {
  return locations.some((loc) =>
    /serbia|srbija|belgrade|beograd|novi sad|ni[sš]|kragujevac|subotica|[cč]a[cč]ak|pan[cč]evo|kraljevo|zrenjanin|smederevo|leskovac|valjevo|[sš]abac|u[zž]ice|vr[sš]ac|sombor|kru[sš]evac/i.test(
      loc,
    ),
  );
}

export function mentionsEurope(locations: string[]): boolean {
  return locations.some((loc) =>
    /europe|emea|\beu\b|germany|deutschland|austria|netherlands|slovenia|croatia|hungary|czech|poland|ireland|spain|france|italy|sweden|denmark|norway|switzerland|berlin|munich|vienna|amsterdam|ljubljana|zagreb|budapest|prague|warsaw|dublin/i.test(
      loc,
    ),
  );
}

export type SourcePlan = {
  sourcesEnabled: JobSource[];
  atsBoardUrls: string[];
};

/**
 * Which boards to read, from the occupation family and where the person
 * wants to work (plan table "Pretraga i izvori").
 *
 * - Serbia, any family: Infostud + LinkedIn (+ HelloWorld for tech)
 * - Remote, tech/business: Remotive, Arbeitnow, public ATS boards
 * - EU on-site: Arbeitnow + LinkedIn
 */
export function planSources(input: {
  family: OccupationFamily | null;
  locations: string[];
  remoteAllowed: boolean;
}): SourcePlan {
  const family = familyProfile(input.family);
  const sources = new Set<JobSource>();
  const serbia = mentionsSerbia(input.locations);
  const europe = mentionsEurope(input.locations);
  const remote =
    input.remoteAllowed && family.remoteCommon;

  if (serbia || (!remote && !europe)) {
    sources.add("infostud");
    sources.add("linkedin");
    if (input.family === "tech_digital") sources.add("helloworld");
  }
  if (remote) {
    sources.add("remotive");
    sources.add("arbeitnow");
    if (family.usesAtsBoards) ATS_SOURCES.forEach((s) => sources.add(s));
  }
  if (europe) {
    sources.add("arbeitnow");
    sources.add("linkedin");
  }

  return {
    sourcesEnabled: [...sources],
    atsBoardUrls:
      remote && family.usesAtsBoards ? [...TECH_BUSINESS_ATS_BOARD_URLS] : [],
  };
}
