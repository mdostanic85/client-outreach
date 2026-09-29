import type { JobSearchParams } from "@/modules/search-profile/schemas";
import type { RawCollectedJob } from "@/modules/collectors/types";
import { jobIdentityKeys } from "@/modules/collectors/identity";

export type FilterDropReason =
  | "excluded_title"
  | "unrelated_title"
  | "too_old"
  | "bad_location"
  | "remote_required"
  | "wrong_employment"
  | "wrong_seniority"
  | "excluded_keyword"
  | "duplicate"
  | "avoid_industry";

const WORK_MODE_RE = /remote|hybrid|on[- ]?site|onsite|wfh|work from home/i;
const SENIORITY_STOP = new Set([
  "senior",
  "lead",
  "staff",
  "principal",
  "junior",
  "mid",
  "level",
]);

export type FilteredJob = {
  job: RawCollectedJob;
  dropReason?: FilterDropReason;
  softFlags: string[];
};

const JUNIOR_RE =
  /\b(junior|intern|internship|entry[- ]level|graduate|apprentice)\b/i;
const ONSITE_RE =
  /\b(on[- ]?site only|office only|no remote|must relocate|relocation required)\b/i;
const US_ONLY_RE =
  /\b(us residents? only|must be (based )?in the (us|united states)|us work authorization required|only candidates (located|based) in the (us|united states))\b/i;

function hoursAgo(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function containsAny(haystack: string, needles: string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const n of needles) {
    const t = n.trim().toLowerCase();
    if (t && lower.includes(t)) return n;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word match: "Intern" must not exclude "International" or "Internal Audit". */
function titleExcluded(title: string, excluded: string[]): boolean {
  return excluded.some((ex) => {
    const e = ex.trim();
    if (!e) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(e)}($|[^\\p{L}\\p{N}])`, "iu").test(title);
  });
}

/**
 * Hard age cut. Boards keep good roles open for weeks, so "posted within"
 * only narrows search queries; the filter never drops anything under 30 days.
 */
const MIN_MAX_AGE_HOURS = 30 * 24;

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 2 && !SENIORITY_STOP.has(t));
}

/**
 * Keep roles that share meaningful tokens with target titles
 * (e.g. "product"+"designer"), or clear UX/UI/product-design titles
 * when the search is design-oriented.
 */
function titleRelevant(title: string, targetTitles: string[]): boolean {
  if (!targetTitles.length) return true;
  const t = title.toLowerCase();
  const designSearch = targetTitles.some((target) =>
    /design|ux|ui|figma/i.test(target),
  );

  for (const target of targetTitles) {
    const tokens = titleTokens(target);
    if (!tokens.length) continue;
    const hits = tokens.filter((tok) => t.includes(tok)).length;
    if (hits >= Math.min(2, tokens.length)) return true;
    if (tokens.length === 1 && hits === 1) return true;
  }

  if (designSearch) {
    return /product\s*design|ux\s*design|ui\s*design|ui\s*\/?\s*ux|\bux\/ui\b|design systems|design\s*lead|head\s*of\s*design|director\s*of\s*design|\b(ux|ui)\s*designer\b/i.test(
      t,
    );
  }
  return false;
}

function employmentTypesForFilter(types: string[]): string[] {
  return types.filter((t) => !WORK_MODE_RE.test(t.trim()));
}

/**
 * Deterministic pre-LLM filter (Serbia remote hard rules + search profile).
 */
export function filterRawJobs(
  raw: RawCollectedJob[],
  params: JobSearchParams,
): {
  kept: RawCollectedJob[];
  dropped: Array<{ job: RawCollectedJob; reason: FilterDropReason }>;
  softFlagged: Array<{ job: RawCollectedJob; flags: string[] }>;
} {
  const dropped: Array<{ job: RawCollectedJob; reason: FilterDropReason }> = [];
  const softFlagged: Array<{ job: RawCollectedJob; flags: string[] }> = [];
  const kept: RawCollectedJob[] = [];
  const fingerprints = new Set<string>();

  for (const job of raw) {
    const blob = `${job.title}\n${job.location ?? ""}\n${job.description}\n${job.remotePolicy ?? ""}`;
    const flags: string[] = [];

    if (titleExcluded(job.title, params.excludedTitles)) {
      dropped.push({ job, reason: "excluded_title" });
      continue;
    }

    if (!titleRelevant(job.title, params.targetTitles)) {
      dropped.push({ job, reason: "unrelated_title" });
      continue;
    }

    if (JUNIOR_RE.test(job.title) && params.seniority.some((s) => /senior|lead|staff|principal/i.test(s))) {
      dropped.push({ job, reason: "wrong_seniority" });
      continue;
    }

    const ageH = hoursAgo(job.postedAt);
    if (ageH == null) flags.push("unknown_posted_date");
    // ATS boards only list open roles; their first-publish date can be months old.
    const liveBoard = job.source === "greenhouse" || job.source === "lever" || job.source === "ashby";
    if (!liveBoard && ageH != null && ageH > Math.max(params.postedWithinHours, MIN_MAX_AGE_HOURS)) {
      dropped.push({ job, reason: "too_old" });
      continue;
    }

    if (containsAny(blob, params.excludedKeywords)) {
      dropped.push({ job, reason: "excluded_keyword" });
      continue;
    }

    if (US_ONLY_RE.test(blob)) {
      dropped.push({ job, reason: "bad_location" });
      continue;
    }

    if (
      params.remoteRequired ||
      params.remotePolicy === "remote_ok_required"
    ) {
      const explicitMode = (job.remotePolicy ?? "").trim();
      if (ONSITE_RE.test(blob) || /^(on[- ]?site|hybrid|office)$/i.test(explicitMode)) {
        dropped.push({ job, reason: "remote_required" });
        continue;
      }
      if (!/remote/i.test(job.remotePolicy ?? "") && job.source !== "remotive") flags.push("unconfirmed_remote");
      const loc = (job.location ?? "").toLowerCase();
      const remoteish =
        /remote|worldwide|anywhere|europe|emea|serbia|eu\b/i.test(loc) ||
        /remote/i.test(job.remotePolicy ?? "") ||
        job.source === "remotive";
      const usCentricLoc =
        loc &&
        !remoteish &&
        /\b(united states|usa|new york|san francisco|london only)\b/i.test(loc) &&
        !/remote/i.test(loc);
      if (usCentricLoc) {
        // Description mentions remote/EMEA → keep for AI scoring with a soft flag.
        if (/remote|europe|emea|worldwide|serbia|work from (home|anywhere)/i.test(blob)) {
          flags.push("ambiguous_location");
        } else {
          dropped.push({ job, reason: "bad_location" });
          continue;
        }
      }
    }

    const employmentAllowed = employmentTypesForFilter(params.employmentTypes);
    if (employmentAllowed.length > 0 && job.employmentType) {
      const et = job.employmentType.toLowerCase();
      const ok = employmentAllowed.some((allowed) => {
        const a = allowed.toLowerCase();
        if (a.includes("full") && /full/.test(et)) return true;
        if (a.includes("contract") && /contract|freelance|temp/.test(et))
          return true;
        return et.includes(a) || a.includes(et);
      });
      // Only drop when clearly mismatched (ignore work-mode labels like "Remote")
      if (
        !ok &&
        (/intern|part[- ]?time/i.test(et) ||
          (/full/.test(et) &&
            !employmentAllowed.some((x) => /full/i.test(x))))
      ) {
        dropped.push({ job, reason: "wrong_employment" });
        continue;
      }
    }

    if (params.avoidIndustries.length) {
      const hit = containsAny(blob, params.avoidIndustries);
      if (hit) {
        dropped.push({ job, reason: "avoid_industry" });
        continue;
      }
    }

    const keys = jobIdentityKeys(job);
    if (keys.some(key => fingerprints.has(key))) {
      dropped.push({ job, reason: "duplicate" });
      continue;
    }
    keys.forEach(key => fingerprints.add(key));

    if (/us preferred|americas tz|hybrid uk|timezone.*us/i.test(blob)) {
      flags.push("ambiguous_timezone");
    }

    kept.push(job);
    if (flags.length) softFlagged.push({ job, flags });
  }

  return { kept, dropped, softFlagged };
}
