import { getUserSettings, updateUserSettings } from "@/modules/settings/user-settings";
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
  const next = SurveySchema.parse({ ...(await getSurvey()), ...patch });
  await updateUserSettings({ surveyJson: JSON.stringify(next) });
  return next;
}
