import { z } from "zod";
import {
  MatchDimensionsSchema,
  type MatchDimensions,
} from "@/modules/matching/score";

export const RemoteFitSchema = z.object({
  status: z.enum(["pass", "unclear", "fail"]),
  policy: z.enum(["remote", "hybrid", "onsite", "unspecified"]),
  geoOk: z.boolean().nullable(),
  timezoneOverlap: z.enum(["full", "partial", "poor", "unknown"]),
  summary: z.string(),
  evidence: z.array(z.string()).default([]),
});

export type RemoteFit = z.infer<typeof RemoteFitSchema>;

export type MatchHighlight = {
  label: string;
  detail: string;
};

/** Split "Label: detail" / "Label — detail" AI strings into scannable rows. */
export function splitMatchReason(raw: string): MatchHighlight {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([^:：—\-]{1,48})\s*[:：—\-]\s+([\s\S]+)$/);
  if (match) {
    return { label: match[1]!.trim(), detail: match[2]!.trim() };
  }
  if (trimmed.length <= 56) {
    return { label: trimmed, detail: "" };
  }
  const cut = trimmed.slice(0, 48);
  const space = cut.lastIndexOf(" ");
  const label = (space > 20 ? cut.slice(0, space) : cut).trim();
  return { label, detail: trimmed };
}

export function highlightsFromReasons(reasons: string[]): MatchHighlight[] {
  return reasons.map(splitMatchReason);
}

export function parseRemoteFitFromScoreJson(
  scoreJson: string | null | undefined,
): RemoteFit | null {
  if (!scoreJson) return null;
  try {
    const parsed = JSON.parse(scoreJson) as { remoteFit?: unknown };
    if (!parsed?.remoteFit) return null;
    return RemoteFitSchema.parse(parsed.remoteFit);
  } catch {
    return null;
  }
}

export function parseMatchExtrasFromScoreJson(
  scoreJson: string | null | undefined,
): {
  remoteFit: RemoteFit | null;
  mainRisk: string | null;
  missingRequirements: string[];
  dimensions: MatchDimensions | null;
} {
  if (!scoreJson) {
    return {
      remoteFit: null,
      mainRisk: null,
      missingRequirements: [],
      dimensions: null,
    };
  }
  try {
    const parsed = JSON.parse(scoreJson) as {
      remoteFit?: unknown;
      mainRisk?: unknown;
      missingRequirements?: unknown;
      dimensions?: unknown;
    };
    let remoteFit: RemoteFit | null = null;
    if (parsed.remoteFit) {
      const result = RemoteFitSchema.safeParse(parsed.remoteFit);
      if (result.success) remoteFit = result.data;
    }
    const mainRisk =
      typeof parsed.mainRisk === "string" && parsed.mainRisk.trim()
        ? parsed.mainRisk.trim()
        : null;
    const missingRequirements = Array.isArray(parsed.missingRequirements)
      ? parsed.missingRequirements.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
      : [];
    let dimensions: MatchDimensions | null = null;
    if (parsed.dimensions) {
      const dimResult = MatchDimensionsSchema.safeParse(parsed.dimensions);
      if (dimResult.success) dimensions = dimResult.data;
    }
    return { remoteFit, mainRisk, missingRequirements, dimensions };
  } catch {
    return {
      remoteFit: null,
      mainRisk: null,
      missingRequirements: [],
      dimensions: null,
    };
  }
}

function inferPolicy(
  remotePolicy: string | null,
  location: string | null,
): RemoteFit["policy"] {
  const blob = `${remotePolicy ?? ""} ${location ?? ""}`.toLowerCase();
  if (/\bhybrid\b/.test(blob)) return "hybrid";
  if (/\bonsite\b|\bon-site\b|\bin[- ]office\b/.test(blob)) return "onsite";
  if (/\bremote\b/.test(blob)) return "remote";
  return "unspecified";
}

function concernBlob(concerns: string[]): string {
  return concerns.join("\n").toLowerCase();
}

/**
 * Heuristic fallback when older matches lack structured `remoteFit`.
 * Prefer AI output once prompt v3+ has scored the role.
 */
export function deriveRemoteFit(input: {
  remotePolicy: string | null;
  location: string | null;
  concerns: string[];
  eligibility: string | null;
  remoteRequired?: boolean;
}): RemoteFit {
  const policy = inferPolicy(input.remotePolicy, input.location);
  const concerns = concernBlob(input.concerns);
  const remoteTalk =
    /\bremote\b|\btimezone\b|\btime zone\b|\btz\b|\bcet\b|\boverlap\b|\blocation\b|\bonsite\b|\bon-site\b|\bhybrid\b/.test(
      concerns,
    );

  let timezoneOverlap: RemoteFit["timezoneOverlap"] = "unknown";
  if (/\bfull(?:-|\s)?day overlap\b|\bfull overlap\b/.test(concerns)) {
    timezoneOverlap = "full";
  } else if (
    /\bpartial\b|\blimited overlap\b|\boverlap challenge\b|\btimezone\b|\btime zone\b|\bcet\b|\bmountain time\b|\best\b|\bpst\b/.test(
      concerns,
    )
  ) {
    timezoneOverlap = "partial";
  } else if (/\bno overlap\b|\bpoor overlap\b|\bincompatible.*zone\b/.test(concerns)) {
    timezoneOverlap = "poor";
  }

  let status: RemoteFit["status"] = "unclear";
  let geoOk: boolean | null = null;

  if (
    input.eligibility === "ineligible" &&
    (policy === "onsite" ||
      /\bremote ban\b|\bmust be onsite\b|\blocation lock\b|\bus only\b|\bmust relocate\b/.test(
        concerns,
      ))
  ) {
    status = "fail";
    geoOk = false;
  } else if (policy === "remote" && !remoteTalk) {
    status = "pass";
    geoOk = true;
  } else if (policy === "remote" && timezoneOverlap === "poor") {
    status = "fail";
    geoOk = false;
  } else if (policy === "remote" && timezoneOverlap === "partial") {
    status = "unclear";
    geoOk = null;
  } else if (policy === "remote" && timezoneOverlap === "full") {
    status = "pass";
    geoOk = true;
  } else if (policy === "onsite") {
    status = input.remoteRequired === false ? "unclear" : "fail";
    geoOk = false;
  } else if (policy === "hybrid") {
    status = "unclear";
    geoOk = null;
  } else if (remoteTalk || input.eligibility === "borderline") {
    status = "unclear";
    geoOk = null;
  } else if (policy === "unspecified" && input.location) {
    status = "unclear";
    geoOk = null;
  } else if (policy === "unspecified" && !input.location) {
    status = "unclear";
  }

  const evidence = input.concerns
    .filter((c) =>
      /\bremote\b|\btimezone\b|\btime zone\b|\blocation\b|\bonsite\b|\bhybrid\b|\bcet\b|\boverlap\b/i.test(
        c,
      ),
    )
    .slice(0, 3);

  const posted =
    input.remotePolicy?.trim() ||
    input.location?.trim() ||
    "No explicit remote/location signal";

  let summary: string;
  if (status === "pass") {
    summary = `Remote looks workable (${posted}).`;
  } else if (status === "fail") {
    summary = `Remote/location likely blocks this role (${posted}).`;
  } else {
    summary = `Remote policy is not explicit enough to confirm (${posted}).`;
  }

  return {
    status,
    policy,
    geoOk,
    timezoneOverlap,
    summary,
    evidence,
  };
}

export function resolveRemoteFit(input: {
  scoreJson: string | null | undefined;
  remotePolicy: string | null;
  location: string | null;
  concerns: string[];
  eligibility: string | null;
  remoteRequired?: boolean;
}): RemoteFit {
  const fromScore = parseRemoteFitFromScoreJson(input.scoreJson);
  if (fromScore) return fromScore;
  return deriveRemoteFit(input);
}

export function remoteStatusLabel(status: RemoteFit["status"]): string {
  if (status === "pass") return "Remote · OK";
  if (status === "fail") return "Remote · No";
  return "Remote · Unclear";
}

export function timezoneLabel(
  overlap: RemoteFit["timezoneOverlap"],
): string | null {
  if (overlap === "full") return "TZ · Full overlap";
  if (overlap === "partial") return "TZ · Partial";
  if (overlap === "poor") return "TZ · Poor overlap";
  return null;
}

/** True when timezone chips would differ across rows — hide when uniform. */
export function timezoneOverlapVaries(
  overlaps: Array<RemoteFit["timezoneOverlap"] | null | undefined>,
): boolean {
  const known = new Set(
    overlaps.filter(
      (value): value is Exclude<RemoteFit["timezoneOverlap"], "unknown"> =>
        value != null && value !== "unknown",
    ),
  );
  return known.size > 1;
}

export function policyLabel(policy: RemoteFit["policy"]): string {
  if (policy === "remote") return "Remote";
  if (policy === "hybrid") return "Hybrid";
  if (policy === "onsite") return "Onsite";
  return "Policy unspecified";
}
