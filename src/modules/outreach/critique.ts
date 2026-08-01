import { z } from "zod";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages } from "@/lib/ai/google";
import { loadPrompt } from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { logger } from "@/lib/logging/logger";

const CritiqueSchema = z.object({
  score: z.number().min(1).max(10),
  issues: z.array(z.string()),
  rewriteHints: z.array(z.string()),
  revisedSubject: z.string().nullable().optional(),
  revisedBody: z.string().nullable().optional(),
});

export type CritiqueResult = z.infer<typeof CritiqueSchema>;

/**
 * Second-model critique — NOT on every draft by default.
 * Call only when: deterministic checks fail after rewrite,
 * high-value lead, user requests alternative, or poor rating.
 */
export async function critiqueDraft(input: {
  subject: string;
  body: string;
  contextJson: string;
}): Promise<CritiqueResult> {
  const system = loadPrompt("email/critique.md");
  const user = JSON.stringify(
    {
      draft: { subject: input.subject, body: input.body },
      context: JSON.parse(input.contextJson),
    },
    null,
    2,
  );

  // Use Haiku for cheaper critique classification-style pass
  const model =
    process.env.PRIVATE_CLASSIFY_MODEL ??
    resolveModel("classifyReply");

  const completion = await anthropicProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "critiqueDraft",
    temperature: 0.2,
  });

  try {
    const trimmed = completion.text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    return CritiqueSchema.parse(
      JSON.parse(fenced ? fenced[1]!.trim() : trimmed),
    );
  } catch (err) {
    logger.warn({ err }, "critiqueDraft parse failed");
    return {
      score: 5,
      issues: ["Critique parse failed"],
      rewriteHints: [],
      revisedSubject: null,
      revisedBody: null,
    };
  }
}
