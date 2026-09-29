import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { cvReviews, profileSources } from "@/db/schema";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import { CV_REVIEW_PROMPT_VERSION, loadPrompt } from "@/lib/ai/prompts";
import { resolveModel, TASK_ROUTES } from "@/lib/ai/routing";
import { assertPublicBudgetAllows } from "@/lib/budgets";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { currentUserId, owned } from "@/modules/auth/current-user";
import { LEVEL_LABELS, type SurveyAnswers } from "@/modules/onboarding/survey";
import { redactPii } from "./redact";

const Score = z.number().min(0).max(100).transform(Math.round);

export const CvReviewSchema = z.object({
  overall: Score,
  headline: z.string(),
  dimensions: z.object({
    clarity: Score,
    impact: Score,
    relevance: Score,
    evidence: Score,
    polish: Score,
  }),
  strengths: z.array(z.string()).min(1).max(3),
  fixes: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .min(1)
    .max(3),
});

export type CvReview = z.infer<typeof CvReviewSchema>;

export type CvReviewView = CvReview & { id: string; createdAt: string };

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

async function latestCvSource() {
  return (
    await getDb()
      .select()
      .from(profileSources)
      .where(
        and(
          await owned(profileSources),
          eq(profileSources.type, "cv"),
          isNull(profileSources.deletedAt),
        ),
      )
      .orderBy(desc(profileSources.ingestedAt))
      .limit(1)
  )[0];
}

function candidateContext(survey: SurveyAnswers): string {
  const lines = [
    survey.role ? `Target role: ${survey.role}` : null,
    survey.level ? `Target level: ${LEVEL_LABELS[survey.level]}` : null,
    survey.workType ? `Looking for: ${survey.workType.replace("_", "-")}` : null,
    survey.websiteUrl
      ? `Portfolio/website: ${survey.websiteUrl} (they have one; only suggest linking it if the CV doesn't)`
      : "Portfolio/website: none given",
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "Target role: not stated";
}

async function complete(system: string, user: string) {
  // Sends the whole CV: private model when available, redacted public fallback otherwise.
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    const model = resolveModel("cvReview");
    const completion = await anthropicProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "cvReview",
      temperature: 0.2,
      maxTokens: 2048,
    });
    return { text: completion.text, model };
  }
  logger.warn("ANTHROPIC_API_KEY missing — CV review using public model with PII redaction");
  const model =
    process.env[TASK_ROUTES.researchAndScore.modelEnv] ??
    TASK_ROUTES.researchAndScore.defaultModel;
  const completion = await googleProvider.complete({
    model,
    messages: buildMessages(system, redactPii(user)),
    task: "cvReview",
    temperature: 0.2,
    jsonMode: true,
  });
  return { text: completion.text, model };
}

/** Reviews the newest uploaded CV against the survey's target role and stores the result. */
export async function runCvReview(survey: SurveyAnswers): Promise<CvReviewView> {
  const source = await latestCvSource();
  const cvText = source?.rawText?.trim();
  if (!source || !cvText) throw new Error("Upload a CV first.");

  await assertPublicBudgetAllows("cvReview");
  const user = `${candidateContext(survey)}\n\nCV:\n"""\n${cvText.slice(0, 24_000)}\n"""`;
  const { text, model } = await complete(loadPrompt("profile/cv-review.md"), user);
  const review = CvReviewSchema.parse(parseJsonLoose(text));

  const id = newId("cvr");
  const createdAt = nowIso();
  await getDb()
    .insert(cvReviews)
    .values({
      id,
      userId: await currentUserId(),
      sourceId: source.id,
      score: review.overall,
      reviewJson: JSON.stringify(review),
      model,
      promptVersion: CV_REVIEW_PROMPT_VERSION,
      createdAt,
    });
  return { ...review, id, createdAt };
}

export async function getLatestCvReview(): Promise<CvReviewView | null> {
  const row = (
    await getDb()
      .select()
      .from(cvReviews)
      .where(await owned(cvReviews))
      .orderBy(desc(cvReviews.createdAt))
      .limit(1)
  )[0];
  if (!row) return null;
  try {
    return {
      ...CvReviewSchema.parse(JSON.parse(row.reviewJson)),
      id: row.id,
      createdAt: row.createdAt,
    };
  } catch {
    return null;
  }
}
