import { z } from "zod";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import { loadPrompt } from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { assertPublicBudgetAllows } from "@/lib/budgets";
import { logger } from "@/lib/logging/logger";
import { OccupationFamilySchema, type OccupationFamily } from "./families";
import { findOccupation } from "./search";

export type ClassifiedOccupation = {
  /** Catalog id when the title is one we know; null for model-classified titles. */
  occupationId: string | null;
  family: OccupationFamily | null;
  en: string;
  sr: string;
  synonyms: string[];
  source: "catalog" | "model" | "none";
};

const ClassifySchema = z.object({
  family: OccupationFamilySchema.nullable(),
  en: z.string().trim().min(1).max(80),
  sr: z.string().trim().min(1).max(80),
  synonyms: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
});

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

/**
 * Catalog first; the model only sees titles we don't recognize, and only the
 * title itself (no profile data). The user confirms the family afterwards.
 */
export async function classifyOccupation(title: string): Promise<ClassifiedOccupation> {
  const trimmed = title.trim();
  const known = findOccupation(trimmed);
  if (known) {
    return {
      occupationId: known.id,
      family: known.family,
      en: known.en,
      sr: known.sr,
      synonyms: known.synonyms,
      source: "catalog",
    };
  }

  const unknown: ClassifiedOccupation = {
    occupationId: null,
    family: null,
    en: trimmed,
    sr: trimmed,
    synonyms: [],
    source: "none",
  };
  if (!process.env.GOOGLE_API_KEY?.trim()) return unknown;

  try {
    await assertPublicBudgetAllows("classifyOccupation");
    const completion = await googleProvider.complete({
      model: resolveModel("classifyOccupation"),
      messages: buildMessages(
        loadPrompt("occupations/classify.md"),
        `Job title: ${trimmed.slice(0, 80)}`,
      ),
      task: "classifyOccupation",
      temperature: 0,
      jsonMode: true,
    });
    const parsed = ClassifySchema.parse(parseJsonLoose(completion.text));
    return { occupationId: null, ...parsed, source: "model" };
  } catch (err) {
    logger.warn({ err }, "occupation classification failed");
    return unknown;
  }
}
