import { z } from "zod";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages } from "@/lib/ai/google";
import { resolveModel } from "@/lib/ai/routing";
import { logger } from "@/lib/logging/logger";

export type ReplyClassification =
  | "reply"
  | "bounce_hard"
  | "bounce_soft"
  | "unsubscribe"
  | "out_of_office"
  | "other";

const HARD_BOUNCE = [
  /\buser unknown\b/i,
  /\bno such user\b/i,
  /\bmailbox (not found|unavailable|does not exist)\b/i,
  /\brecipient address rejected\b/i,
  /\b550[ \-]?5\.1\.1\b/,
  /\b551[ \-]?5\.1\.1\b/,
  /\binvalid recipient\b/i,
  /\baddress rejected\b/i,
  /\bpermanent failure\b/i,
  /\bundeliverable\b/i,
];

const SOFT_BOUNCE = [
  /\bmailbox full\b/i,
  /\bover quota\b/i,
  /\btry again later\b/i,
  /\btemporary (?:delivery )?failure\b/i,
];

const UNSUBSCRIBE = [
  /\bunsubscribe\b/i,
  /\bopt[ -]?out\b/i,
  /\bremove me\b/i,
  /\bstop emailing\b/i,
  /\bdo not contact\b/i,
  /\btake me off\b/i,
];

const OOO = [
  /\bout of office\b/i,
  /\bautomatic reply\b/i,
  /\baway from (the )?office\b/i,
  /\bon leave\b/i,
];

/**
 * Deterministic bounce / unsubscribe / OOO rules first.
 * Returns null when ambiguous — caller may use Haiku.
 */
export function classifyDeterministic(
  subject: string,
  body: string,
): { classification: ReplyClassification; confidence: "high" | "low" } | null {
  const text = `${subject}\n${body}`;

  if (HARD_BOUNCE.some((r) => r.test(text))) {
    return { classification: "bounce_hard", confidence: "high" };
  }
  if (UNSUBSCRIBE.some((r) => r.test(text))) {
    return { classification: "unsubscribe", confidence: "high" };
  }
  if (OOO.some((r) => r.test(text))) {
    return { classification: "out_of_office", confidence: "high" };
  }
  if (SOFT_BOUNCE.some((r) => r.test(text))) {
    return { classification: "bounce_soft", confidence: "high" };
  }

  return null;
}

const LlmSchema = z.object({
  classification: z.enum([
    "reply",
    "bounce_hard",
    "bounce_soft",
    "unsubscribe",
    "out_of_office",
    "other",
  ]),
});

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

/** Claude Haiku only when deterministic rules are inconclusive. */
export async function classifyWithLlm(
  subject: string,
  body: string,
): Promise<ReplyClassification> {
  const model = resolveModel("classifyReply");
  const system =
    "Classify an inbound outreach email reply. Return JSON only: " +
    '{"classification":"reply|bounce_hard|bounce_soft|unsubscribe|out_of_office|other"}. ' +
    "reply = human engagement; never invent facts.";
  const user = JSON.stringify({
    subject,
    body: body.slice(0, 4000),
  });

  const completion = await anthropicProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "classifyReply",
    temperature: 0,
  });

  const parsed = LlmSchema.parse(parseJsonLoose(completion.text));
  logger.info(
    { classification: parsed.classification, model },
    "Reply classified via LLM",
  );
  return parsed.classification;
}

export async function classifyReply(
  subject: string,
  body: string,
): Promise<{
  classification: ReplyClassification;
  source: "deterministic" | "llm";
}> {
  const det = classifyDeterministic(subject, body);
  if (det && det.confidence === "high") {
    return { classification: det.classification, source: "deterministic" };
  }
  try {
    const classification = await classifyWithLlm(subject, body);
    return { classification, source: "llm" };
  } catch (err) {
    logger.warn({ err }, "LLM reply classification failed; defaulting to other");
    return {
      classification: det?.classification ?? "other",
      source: det ? "deterministic" : "llm",
    };
  }
}
