import { getUserSettings } from "@/modules/settings/user-settings";

export type CountryPolicy =
  | "draft_allowed"
  | "manual_review_required"
  | "prior_interaction_required"
  | "blocked"
  | "unknown";

export const DEFAULT_COUNTRY_POLICY: Record<string, CountryPolicy> = {
  DE: "prior_interaction_required",
  AT: "prior_interaction_required",
  // Unreviewed EU countries default to manual_review_required via resolve
};

const EU_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const COUNTRY_ALIASES: Record<string, string> = {
  germany: "DE",
  deutschland: "DE",
  austria: "AT",
  österreich: "AT",
  oesterreich: "AT",
  switzerland: "CH",
  schweiz: "CH",
  netherlands: "NL",
  france: "FR",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  "united states": "US",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
};

export function normalizeCountryCode(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (lower.includes(alias)) return code;
  }
  // Try first token if "Berlin, Germany"
  const parts = lower.split(/[,\-/]/).map((p) => p.trim());
  for (const part of parts.reverse()) {
    if (COUNTRY_ALIASES[part]) return COUNTRY_ALIASES[part];
  }
  return null;
}

export async function loadCountryPolicyMap(): Promise<
  Record<string, CountryPolicy>
> {
  const setting = (await getUserSettings());
  let stored: Record<string, CountryPolicy> = {};
  try {
    stored = JSON.parse(setting?.countryPolicyJson || "{}") as Record<
      string,
      CountryPolicy
    >;
  } catch {
    stored = {};
  }
  return { ...DEFAULT_COUNTRY_POLICY, ...stored };
}

export async function resolveCountryPolicy(countryRaw?: string | null): Promise<{
  code: string | null;
  policy: CountryPolicy;
}> {
  const code = normalizeCountryCode(countryRaw);
  const map = await loadCountryPolicyMap();
  if (!code) return { code: null, policy: "unknown" };
  if (map[code]) return { code, policy: map[code] };
  if (EU_CODES.has(code)) return { code, policy: "manual_review_required" };
  return { code, policy: "unknown" };
}

/** unknown behaves as manual_review_required */
export function effectivePolicy(policy: CountryPolicy): CountryPolicy {
  return policy === "unknown" ? "manual_review_required" : policy;
}

export async function canGenerateDraft(countryRaw?: string | null): Promise<{
  allowed: boolean;
  policy: CountryPolicy;
  code: string | null;
  reason?: string;
}> {
  const { code, policy } = await resolveCountryPolicy(countryRaw);
  const effective = effectivePolicy(policy);

  if (effective === "blocked") {
    return { allowed: false, policy, code, reason: "Country is blocked for outreach" };
  }
  if (effective === "prior_interaction_required") {
    return {
      allowed: false,
      policy,
      code,
      reason:
        "Prior interaction required before drafting (e.g. Germany/Austria baseline)",
    };
  }
  if (effective === "manual_review_required") {
    return {
      allowed: true,
      policy,
      code,
      reason: "Manual review required — draft allowed but flag for review",
    };
  }
  return { allowed: true, policy, code };
}
