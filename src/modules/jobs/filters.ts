import type { JobSearchParams } from "@/modules/search-profile/schemas";
import type { RawCollectedJob } from "@/modules/collectors/types";
import { jobFingerprint } from "@/modules/collectors/types";

export type FilterDropReason =
  | "excluded_title"
  | "too_old"
  | "bad_location"
  | "remote_required"
  | "wrong_employment"
  | "wrong_seniority"
  | "excluded_keyword"
  | "duplicate"
  | "avoid_industry";

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

function titleExcluded(title: string, excluded: string[]): boolean {
  const t = title.toLowerCase();
  return excluded.some((ex) => {
    const e = ex.trim().toLowerCase();
    return e.length > 0 && t.includes(e);
  });
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

    if (titleExcluded(job.title, params.excludedTitles)) {
      dropped.push({ job, reason: "excluded_title" });
      continue;
    }

    if (JUNIOR_RE.test(job.title) && params.seniority.some((s) => /senior|lead|staff|principal/i.test(s))) {
      dropped.push({ job, reason: "wrong_seniority" });
      continue;
    }

    const ageH = hoursAgo(job.postedAt);
    if (ageH != null && ageH > params.postedWithinHours * 1.5) {
      // Allow slightly older than postedWithinHours for free APIs that lag
      if (ageH > Math.max(params.postedWithinHours, 72) * 2) {
        dropped.push({ job, reason: "too_old" });
        continue;
      }
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
      if (ONSITE_RE.test(blob)) {
        dropped.push({ job, reason: "remote_required" });
        continue;
      }
      const loc = (job.location ?? "").toLowerCase();
      const remoteish =
        /remote|worldwide|anywhere|europe|emea|serbia|eu\b/i.test(loc) ||
        /remote/i.test(job.remotePolicy ?? "") ||
        job.source === "remotive";
      if (
        loc &&
        !remoteish &&
        /\b(united states|usa|new york|san francisco|london only)\b/i.test(loc) &&
        !/remote/i.test(loc)
      ) {
        dropped.push({ job, reason: "bad_location" });
        continue;
      }
    }

    if (params.employmentTypes.length > 0 && job.employmentType) {
      const et = job.employmentType.toLowerCase();
      const ok = params.employmentTypes.some((allowed) => {
        const a = allowed.toLowerCase();
        if (a.includes("full") && /full/.test(et)) return true;
        if (a.includes("contract") && /contract|freelance|temp/.test(et))
          return true;
        return et.includes(a) || a.includes(et);
      });
      // Only drop when clearly mismatched
      if (
        !ok &&
        (/intern|part[- ]?time/i.test(et) ||
          (/full/.test(et) &&
            !params.employmentTypes.some((x) => /full/i.test(x))))
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

    const fp = jobFingerprint({
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      sourceUrl: job.sourceUrl,
    });
    if (fingerprints.has(fp)) {
      dropped.push({ job, reason: "duplicate" });
      continue;
    }
    fingerprints.add(fp);

    const flags: string[] = [];
    if (/us preferred|americas tz|hybrid uk|timezone.*us/i.test(blob)) {
      flags.push("ambiguous_timezone");
    }

    kept.push(job);
    if (flags.length) softFlagged.push({ job, flags });
  }

  return { kept, dropped, softFlagged };
}
