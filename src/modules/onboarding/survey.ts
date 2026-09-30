import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { owned } from "@/modules/auth/current-user";
import { getUserSettings } from "@/modules/settings/user-settings";
import { SurveySchema, type SurveyAnswers } from "./survey-core";

export * from "./survey-core";

export async function getSurvey(): Promise<SurveyAnswers> {
  const row = await getUserSettings();
  try {
    return SurveySchema.parse(JSON.parse(row.surveyJson || "{}"));
  } catch {
    return {};
  }
}

/** Merges one screen's answer into the stored survey. */
export async function saveSurveyPatch(patch: SurveyAnswers): Promise<SurveyAnswers> {
  const row = await getUserSettings();
  const next = SurveySchema.parse({ ...(await getSurvey()), ...patch });
  await getDb()
    .update(settings)
    .set({ surveyJson: JSON.stringify(next), updatedAt: nowIso() })
    .where(and(await owned(settings), eq(settings.id, row.id)));
  return next;
}
