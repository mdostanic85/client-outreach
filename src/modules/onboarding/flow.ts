import { FAMILY_PROFILES } from "@/modules/occupations/families";
import { surveySteps, type SurveyAnswers, type SurveyStep } from "./survey-core";

/**
 * Onboarding navigation: which screens a person sees, how answers advance
 * them, and where Back goes. Pure, so the order can be tested without a UI.
 */

export type FlowStep =
  | SurveyStep
  | "cv"
  | "website"
  | "linkedin"
  | "analyzing"
  | "summary"
  | "review";

/** Every screen for this person, in order. Changes once we know the family. */
export function flowOrder(survey: SurveyAnswers): FlowStep[] {
  const family = survey.occupationFamily ? FAMILY_PROFILES[survey.occupationFamily] : null;
  return [
    ...surveySteps(survey),
    "cv",
    ...(family?.asksForWebsite ?? true ? (["website"] as const) : []),
    // LinkedIn exports matter where people keep a LinkedIn profile.
    ...(family?.usesLevels ?? true ? (["linkedin"] as const) : []),
    "analyzing",
    "summary",
    "review",
  ];
}

/**
 * Screens the person actually sees.
 * Related answers share one screen so setup stays short (Wellfound-style),
 * while search still stores the same step fields.
 */
export const QUESTION_GROUPS: FlowStep[][] = [
  ["intro", "role"],
  ["family"],
  ["experience", "level", "engagement", "workMode"],
  ["location", "pay", "availability"],
  ["details", "languages", "priorities"],
  ["cv", "website", "linkedin"],
];

/**
 * The screen after answering. `covers` is every step the current screen
 * finishes, so a combined screen jumps past all of them.
 */
export function nextStepAfter(
  survey: SurveyAnswers,
  current: FlowStep,
  covers: FlowStep[] = [current],
): FlowStep {
  const order = flowOrder(survey);
  const indexes = covers.map((item) => order.indexOf(item)).filter((index) => index >= 0);
  const last = indexes.length ? Math.max(...indexes) : order.indexOf(current);
  return order[last + 1] ?? "cv";
}

/** Progress shown in the stepper: question groups this person sees, and where they are. */
export function flowProgress(order: FlowStep[], step: FlowStep) {
  const groups = QUESTION_GROUPS.map((group) => group.filter((item) => order.includes(item))).filter(
    (group) => group.length > 0,
  );
  const groupIndex = groups.findIndex((group) => group.includes(step));
  return {
    groupCount: groups.length,
    groupIndex,
    progress: groupIndex < 0 ? 1 : (groupIndex + 1) / groups.length,
  };
}

/** Where Back goes: the screen before the first step of the current group. */
export function backTargetFor(order: FlowStep[], step: FlowStep): FlowStep | null {
  const group = QUESTION_GROUPS.find((item) => item.includes(step));
  const first = group?.find((item) => order.includes(item)) ?? step;
  const index = order.indexOf(first);
  return index > 0 ? order[index - 1]! : null;
}
