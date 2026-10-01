import type { ContactConfidence } from "@/modules/contacts/confidence";

export const BANNED_PHRASES = [
  "i hope this email finds you well",
  "i wanted to reach out",
  "leverage",
  "synergy",
  "revolutionize",
  "cutting-edge",
  "pick your brain",
  "circle back",
  "just checking in",
  "just bumping this",
] as const;

export type QualityIssue = {
  code: string;
  severity: "error" | "warn";
  message: string;
};

export type DraftQualityInput = {
  subject: string;
  body: string;
  kind: "initial" | "follow_up_1" | "follow_up_2" | "reply";
  contactConfidence: ContactConfidence;
  contactEmail?: string | null;
  /** Claims / excerpts the draft may reference */
  evidenceExcerpts?: string[];
  companyName?: string;
  senderIdentity?: string;
  /** When jurisdiction requires explicit opt-out language */
  requireOptOut?: boolean;
};

const ASK_PATTERNS =
  /\b(would you|could you|can we|open to|interested in|free for|grab (a |an )?|chat|call|meet|intro)\b/gi;

const OPT_OUT_PATTERNS =
  /opt[- ]?out|unsubscribe|reply (with )?(stop|no)|prefer not to|remove me/i;

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function sentenceOpenings(body: string): string[] {
  return body
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
}

export function checkDraftQuality(input: DraftQualityInput): {
  ok: boolean;
  issues: QualityIssue[];
} {
  const issues: QualityIssue[] = [];
  const subject = input.subject.trim();
  const body = input.body.trim();
  const words = wordCount(body);

  if (!subject) {
    issues.push({
      code: "missing_subject",
      severity: "error",
      message: "Subject is missing",
    });
  } else if (subject.split(/\s+/).filter(Boolean).length > 6) {
    issues.push({
      code: "subject_too_long",
      severity: "error",
      message: "Subject must be at most six words",
    });
  }

  const minWords = input.kind === "initial" ? 70 : 40;
  const maxWords = input.kind === "initial" ? 120 : 80;
  if (words < minWords) {
    issues.push({
      code: "word_count_low",
      severity: "error",
      message: `Body has ${words} words; expected ≥${minWords} for ${input.kind}`,
    });
  } else if (words > maxWords) {
    issues.push({
      code: "word_count_high",
      severity: "warn",
      message: `Body has ${words} words; expected ≤${maxWords} for ${input.kind}`,
    });
  }

  const lower = body.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        code: "banned_phrase",
        severity: "error",
        message: `Banned phrase: "${phrase}"`,
      });
    }
  }

  const openings = sentenceOpenings(body);
  const seen = new Set<string>();
  for (const o of openings) {
    if (!o) continue;
    if (seen.has(o)) {
      issues.push({
        code: "repeated_opening",
        severity: "warn",
        message: `Repeated sentence opening: "${o}"`,
      });
      break;
    }
    seen.add(o);
  }

  const identity =
    input.senderIdentity?.toLowerCase() ?? "miloš dostanić";
  const identityAlt = "milos dostanic";
  if (
    !lower.includes(identity) &&
    !lower.includes(identityAlt) &&
    !lower.includes("miloš") &&
    !lower.includes("milos")
  ) {
    issues.push({
      code: "missing_identity",
      severity: "error",
      message: "Body should include sender identity (Miloš)",
    });
  }

  const asks = body.match(ASK_PATTERNS) ?? [];
  // Rough: count distinct ask-ish clauses by sentence
  const askSentences = body
    .split(/[.!?]+/)
    .filter((s) => ASK_PATTERNS.test(s));
  // Reset lastIndex side effects
  ASK_PATTERNS.lastIndex = 0;
  if (askSentences.length > 1 || asks.length > 4) {
    issues.push({
      code: "multiple_asks",
      severity: "error",
      message: "More than one ask detected — keep a single low-friction ask",
    });
  }

  if (input.requireOptOut && !OPT_OUT_PATTERNS.test(body)) {
    issues.push({
      code: "missing_opt_out",
      severity: "error",
      message: "Opt-out language required for this jurisdiction",
    });
  }

  if (
    input.contactConfidence === "pattern_unverified" ||
    input.contactConfidence === "unknown"
  ) {
    issues.push({
      code: "contact_confidence_mismatch",
      severity: "error",
      message: `Contact confidence "${input.contactConfidence}" is not eligible for automated send`,
    });
  }

  // Unsupported company facts: flag proper-noun-ish claims not in evidence
  if (input.evidenceExcerpts && input.evidenceExcerpts.length > 0) {
    const evidenceBlob = input.evidenceExcerpts.join(" ").toLowerCase();
    const company = (input.companyName ?? "").toLowerCase();
    // Look for quoted or capitalized phrases of 3+ words not in evidence
    const candidates =
      body.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,}\b/g) ?? [];
    for (const c of candidates.slice(0, 5)) {
      const cl = c.toLowerCase();
      if (company && cl.includes(company)) continue;
      if (cl.includes("miloš") || cl.includes("milos")) continue;
      if (!evidenceBlob.includes(cl)) {
        issues.push({
          code: "unsupported_fact",
          severity: "warn",
          message: `Possible unsupported company fact: "${c}"`,
        });
      }
    }
  }

  const ok = !issues.some((i) => i.severity === "error");
  return { ok, issues };
}
