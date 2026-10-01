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

/**
 * Boards that list only remote work. They are read for every family where
 * remote work exists, whether or not the person asked for remote: the jobs
 * list filters by work mode and by whether Serbia is allowed, and a
 * remote role is often open to Serbia.
 */
export const REMOTE_BOARD_SOURCES: JobSource[] = [
  "remotive",
  "arbeitnow",
  "remoteok",
  "himalayas",
  "jobicy",
  "weworkremotely",
  "workingnomads",
];

/**
 * Public career pages of employers that hire in Serbia, confirmed to expose
 * a documented board feed. Only families with `usesAtsBoards` scan these.
 * EURES is not here: eures.europa.eu disallows `/search/`, and the portal API
 * requires authorization.
 */
export const SERBIA_ATS_BOARD_URLS = [
  "https://huaweitechnologiesslovenia.teamtailor.com/jobs",
  "https://sokin.teamtailor.com/jobs",
];

function vendorOfBoard(url: string): JobSource | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".teamtailor.com")) return "teamtailor";
    if (host === "apply.workable.com") return "workable";
    if (host.endsWith(".recruitee.com")) return "recruitee";
    if (host.endsWith(".smartrecruiters.com")) return "smartrecruiters";
    if (host.endsWith(".jobs.personio.de") || host.endsWith(".jobs.personio.com")) {
      return "personio";
    }
  } catch {
    return null;
  }
  return null;
}

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
 * - Serbia, any family: Infostud, Poslovi, NSZ, LinkedIn (+ HelloWorld and Joberty for tech)
 * - Families where remote work is common: the remote boards (Remotive for families with
 *   categories, Arbeitnow, Remote OK, Himalayas, Jobicy, We Work Remotely, Working Nomads),
 *   even when remote was not asked for
 * - Remote requested, tech/business: public ATS boards too
 * - Serbia employers on a known ATS: the manual Serbia catalog, for families that use ATS boards
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
  const atsBoardUrls: string[] = [];

  if (serbia || (!remote && !europe)) {
    sources.add("infostud");
    sources.add("poslovi");
    sources.add("nsz");
    sources.add("linkedin");
    if (input.family === "tech_digital") {
      sources.add("helloworld");
      sources.add("joberty");
    }
  }
  if (family.remoteCommon) {
    for (const source of REMOTE_BOARD_SOURCES) {
      if (source === "remotive" && family.remotiveCategories.length === 0) continue;
      sources.add(source);
    }
  }
  if (remote) {
    if (family.usesAtsBoards) ATS_SOURCES.forEach((s) => sources.add(s));
  }
  if (family.usesAtsBoards && serbia) {
    for (const url of SERBIA_ATS_BOARD_URLS) {
      const vendor = vendorOfBoard(url);
      if (!vendor) continue;
      sources.add(vendor);
      atsBoardUrls.push(url);
    }
  }
  if (remote && family.usesAtsBoards) {
    atsBoardUrls.push(...TECH_BUSINESS_ATS_BOARD_URLS);
  }
  if (europe) {
    sources.add("arbeitnow");
    sources.add("linkedin");
  }

  return {
    sourcesEnabled: [...sources],
    atsBoardUrls,
  };
}
