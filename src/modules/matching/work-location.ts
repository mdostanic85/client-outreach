/**
 * Can the person do this job from where they live, and how do they work it?
 *
 * Deterministic, so it runs on every collected job without an AI call and
 * the answer is the same for a job the AI has and has not scored. The AI's
 * `remoteFit` still adds detail on the jobs it scores.
 *
 * "Blocked" is for clear cases only (a US-only remote role, an on-site job in
 * Berlin for someone in Serbia). Anything ambiguous is "unclear" and stays in
 * the list with a flag, because hiding a job the person could do is worse
 * than showing one they cannot.
 */

export type WorkMode = "remote" | "hybrid" | "onsite" | "unspecified";
export type HomeAccess = "ok" | "unclear" | "blocked";

export type WorkLocationAssessment = {
  mode: WorkMode;
  home: HomeAccess;
  /** Short, user-facing: "Remote · worldwide", "Remote · US only". */
  reason: string;
};

export type WorkLocationInput = {
  source: string;
  title: string;
  location?: string | null;
  remotePolicy?: string | null;
  description?: string | null;
};

/** Boards that only list remote work. */
const REMOTE_ONLY_SOURCES = new Set([
  "remotive",
  "remoteok",
  "himalayas",
  "jobicy",
  "weworkremotely",
  "workingnomads",
]);

/** Serbian boards where a listing with no work-mode marker is an office job in Serbia. */
const SERBIAN_BOARDS = new Set(["infostud", "helloworld", "poslovi", "joberty", "nsz"]);

const PLACE_ALIASES: Record<string, RegExp> = {
  serbia:
    /\bserbia\b|\bsrbija\b|\bbelgrade\b|\bbeograd\b|novi sad|\bniš\b|kragujevac|subotica|zemun|pančevo|pancevo|čačak|cacak|novi beograd|vojvodina|kraljevo|smederevo|valjevo|užice|uzice/i,
};

const REMOTE_WORD =
  /\bremote(ly)?\b|work from (home|anywhere)|\bwfh\b|telecommut|rad od ku[cć]e|rad na daljinu|\bdaljinu\b/i;
const HYBRID_WORD = /\bhybrid\b|hibrid/i;
const ONSITE_WORD =
  /\bon[- ]?site\b|\bin[- ]office\b|\bin[- ]person\b|u kancelariji|rad u kancelariji|rad na terenu/i;
const STRONG_REMOTE_IN_TEXT =
  /\b(fully|100%|completely) remote\b|\bremote[- ](first|position|role|job|work)\b|\bwork remotely\b|\bthis (is a )?remote\b/i;

const WORLDWIDE =
  /\bworld[- ]?wide\b|\banywhere\b|\bglobal(ly)?\b|\bany location\b|\bfully distributed\b|\bwork from anywhere\b|\bnomad/i;
/** Regions that geographically include Serbia and are normally open to it. */
const WIDE_REGION =
  /\beurope\b|\bemea\b|\bcentral europe\b|\beastern europe\b|\bsoutheast(ern)? europe\b|\bbalkans?\b|\bcet\b|\bcest\b|\beet\b|\butc[+-]?[0-3]\b|\bgmt[+-]?[0-3]\b/i;
/** The EU is not Serbia: roles tied to it usually need EU work rights. */
const EU_ONLY = /\b(eu|eea|european union|european economic area)\b(?!\s*(?:and|\+|,)?\s*(?:worldwide|serbia))/i;

/** Wording in a posting that suggests it is not tied to the listed place. */
const OPEN_HINT = /\bremote\b|\beurope\b|\bemea\b|\bworldwide\b|\bserbia\b|work from (home|anywhere)/i;

const FOREIGN_REGION =
  /\b(us|usa|u\.s\.a?\.?|united states|america(s)?|north america|canada|latam|latin america|brazil|brasil|mexico|argentina|colombia|chile|india|australia|new zealand|philippines|apac|asia|singapore|japan|china|pakistan|nigeria|kenya|south africa|africa|uk|u\.k\.|united kingdom|great britain|england|scotland)\b/i;
const FOREIGN_COUNTRY =
  /\b(germany|deutschland|austria|netherlands|france|spain|italy|portugal|poland|sweden|denmark|finland|norway|belgium|switzerland|czech(ia)?|romania|bulgaria|croatia|slovenia|hungary|greece|ireland|estonia|latvia|lithuania|slovakia|luxembourg|cyprus|malta|turkey|israel|uae|dubai|qatar|saudi)\b/i;
const FOREIGN_CITY =
  /\b(berlin|munich|hamburg|frankfurt|cologne|london|manchester|paris|amsterdam|rotterdam|vienna|zurich|geneva|dublin|madrid|barcelona|lisbon|warsaw|krak[oó]w|prague|budapest|bucharest|sofia|zagreb|ljubljana|sarajevo|skopje|athens|stockholm|copenhagen|oslo|helsinki|new york|san francisco|los angeles|austin|seattle|boston|chicago|toronto|vancouver|sydney|melbourne|tel aviv|bangalore|bengaluru|mumbai)\b/i;

/** "Must be based in / authorised to work in X" style limits in the posting body. */
const PLACE_WORDS = "([a-z.]+(?:[\\s,/&-]+[a-z.]+){0,4})";
const RESIDENCY_LIMITS = [
  new RegExp(
    `\\b(?:must|need to|required to|have to)\\s+(?:be\\s+)?(?:located|based|reside|residing|resident|living|live)\\s+(?:in|within)\\s+(?:the\\s+)?${PLACE_WORDS}`,
    "gi",
  ),
  new RegExp(
    `\\b(?:authori[sz]ed|eligible|legally entitled|right|permit)\\s+(?:to\\s+work|for work)\\s+(?:in|within)\\s+(?:the\\s+)?${PLACE_WORDS}`,
    "gi",
  ),
  new RegExp(
    `\\bonly\\s+(?:accepting\\s+)?(?:applicants|candidates)\\s+(?:located|based|from)\\s+(?:in\\s+)?(?:the\\s+)?${PLACE_WORDS}`,
    "gi",
  ),
  /\b(us|u\.s\.|uk|canadian)\s+(?:citizens?|residents?)\s+only\b/gi,
];

function text(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function namesHome(value: string, places: readonly string[]): boolean {
  const lower = value.toLowerCase();
  return places.some((place) => {
    const key = place.trim().toLowerCase();
    if (!key || /^remote$|^hybrid$/.test(key)) return false;
    const alias = PLACE_ALIASES[key];
    return alias ? alias.test(value) : lower.includes(key);
  });
}

function namesForeignPlace(value: string): boolean {
  return FOREIGN_REGION.test(value) || FOREIGN_COUNTRY.test(value) || FOREIGN_CITY.test(value);
}

export function detectWorkMode(job: WorkLocationInput): WorkMode {
  const policy = text(job.remotePolicy);
  const location = text(job.location);
  const title = text(job.title);
  const head = `${policy} ${location} ${title}`;

  if (HYBRID_WORD.test(head)) return "hybrid";
  if (/^(on[- ]?site|office)$/i.test(policy) || ONSITE_WORD.test(head)) return "onsite";
  if (/^remote$/i.test(policy) || REMOTE_WORD.test(head)) return "remote";
  if (REMOTE_ONLY_SOURCES.has(job.source)) return "remote";

  const body = text(job.description).slice(0, 2500);
  if (HYBRID_WORD.test(body) && !/\bnot hybrid\b/i.test(body)) return "hybrid";
  if (STRONG_REMOTE_IN_TEXT.test(body)) return "remote";
  if (SERBIAN_BOARDS.has(job.source)) return "onsite";
  return "unspecified";
}

/**
 * Restrictions written in the posting: "US only", "must be located in the
 * UK", "authorised to work in the EU". Returns what the restriction names.
 */
function bodyRestriction(body: string): { place: string; eu: boolean } | null {
  for (const pattern of RESIDENCY_LIMITS) {
    for (const match of body.matchAll(pattern)) {
      const place = text(match[1]).toLowerCase();
      if (!place) continue;
      if (PLACE_ALIASES.serbia!.test(place) || WORLDWIDE.test(place)) continue;
      if (EU_ONLY.test(place) && !FOREIGN_REGION.test(place)) return { place, eu: true };
      if (FOREIGN_REGION.test(place) || FOREIGN_COUNTRY.test(place) || FOREIGN_CITY.test(place)) {
        return { place, eu: false };
      }
    }
  }
  return null;
}

export function assessWorkLocation(
  job: WorkLocationInput,
  home: { places: readonly string[] },
): WorkLocationAssessment {
  const mode = detectWorkMode(job);
  const location = text(job.location);
  const body = text(job.description).slice(0, 4000);
  const atHome = namesHome(location, home.places);
  const foreignInLocation = namesForeignPlace(location);

  if (mode === "remote") {
    if (atHome || WORLDWIDE.test(location) || WIDE_REGION.test(location)) {
      const reason = atHome ? "Remote · open to Serbia" : WORLDWIDE.test(location) ? "Remote · worldwide" : "Remote · Europe";
      return { mode, home: "ok", reason };
    }
    if (foreignInLocation) {
      const named = location.match(FOREIGN_REGION) ?? location.match(FOREIGN_COUNTRY) ?? location.match(FOREIGN_CITY);
      const place = named?.[0] ?? "other region";
      // "Remote - US" limits who can apply. A bare city on a remote listing is
      // usually just the company's base, so it stays in the list with a flag.
      if (REMOTE_WORD.test(location)) return { mode, home: "blocked", reason: `Remote · ${place} only` };
      return { mode, home: "unclear", reason: `Remote · based in ${place}, check where you can work from` };
    }
    if (EU_ONLY.test(location)) {
      return { mode, home: "unclear", reason: "Remote · EU only, check work rights" };
    }
    const limit = bodyRestriction(body);
    if (limit) {
      return limit.eu
        ? { mode, home: "unclear", reason: "Remote · EU work rights may be needed" }
        : { mode, home: "blocked", reason: `Remote · ${limit.place} only` };
    }
    if (/\bus[- ]based\b|\bu\.s\.[- ]based\b|\bus residents? only\b|\bus work authori[sz]ation\b/i.test(body)) {
      return { mode, home: "blocked", reason: "Remote · US only" };
    }
    return { mode, home: "unclear", reason: location ? "Remote · region not stated" : "Remote · where from is not stated" };
  }

  if (mode === "onsite" || mode === "hybrid") {
    const label = mode === "hybrid" ? "Hybrid" : "On-site";
    if (atHome) return { mode, home: "ok", reason: `${label} · Serbia` };
    if (SERBIAN_BOARDS.has(job.source) && !foreignInLocation) {
      return { mode, home: "ok", reason: `${label} · Serbia` };
    }
    if (foreignInLocation) {
      return { mode, home: "blocked", reason: `${label} · ${location || "abroad"}, not Serbia` };
    }
    return { mode, home: "unclear", reason: `${label} · location not stated` };
  }

  // Mode not stated: the place decides.
  if (atHome) return { mode, home: "ok", reason: "Serbia" };
  if (SERBIAN_BOARDS.has(job.source) && !foreignInLocation) return { mode, home: "ok", reason: "Serbia" };
  if (foreignInLocation) {
    // A posting that says it is open to remote / Europe / worldwide is not an on-site abroad job.
    if (OPEN_HINT.test(body)) return { mode, home: "unclear", reason: `${location} · may be open to remote` };
    return { mode, home: "blocked", reason: `${location}, not Serbia` };
  }
  return { mode, home: "unclear", reason: "Where it is done is not stated" };
}

/** True when the person searches only from home (no "abroad" places), so foreign on-site is out. */
export function homePlacesOf(locations: readonly string[]): string[] {
  return locations.filter((place) => place.trim() && !/^(remote|hybrid)$/i.test(place.trim()));
}
