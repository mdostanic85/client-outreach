"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Choices, Screen, Stepper } from "@/components/onboarding/ui";
import { AnalyzingStep } from "@/components/onboarding/steps/analyzing-step";
import { CvStep } from "@/components/onboarding/steps/cv-step";
import { FitStep } from "@/components/onboarding/steps/fit-step";
import { PlacePayStep } from "@/components/onboarding/steps/place-pay-step";
import { ReviewStep } from "@/components/onboarding/steps/review-step";
import { RoleStep } from "@/components/onboarding/steps/role-step";
import { SummaryStep } from "@/components/onboarding/steps/summary-step";
import { WorkStep } from "@/components/onboarding/steps/work-step";
import {
  backTargetFor,
  flowOrder,
  flowProgress,
  nextStepAfter,
  type FlowStep,
} from "@/modules/onboarding/flow";
import { classifyRoleAction, completeOnboardingAction, confirmProfileAction, saveSurveyStepAction } from "@/modules/onboarding/actions";
import { remoteOffered, type ProfileSummary, type SurveyAnswers } from "@/modules/onboarding/survey-core";
import {
  FAMILY_PROFILES,
  OCCUPATION_FAMILIES,
  type OccupationFamily,
} from "@/modules/occupations/families";
import { occupationSearchTerms } from "@/modules/occupations/search";
import type { CvReview } from "@/modules/profile/cv-review";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EXIT: [number, number, number, number] = [0.32, 0, 0.67, 0];


/**
 * Onboarding screen sequence: owns the survey answers and the current step,
 * saves each answer, and hands each screen its slice. Screens live in `steps/`.
 */
export function OnboardingFlow({
  initialStep,
  initialSurvey,
  userName,
  hasCv,
  initialSummary,
  initialReview,
}: {
  initialStep: FlowStep;
  initialSurvey: SurveyAnswers;
  initialSummary: ProfileSummary | null;
  userName: string | null;
  hasCv: boolean;
  initialReview: CvReview | null;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [step, setStep] = useState<FlowStep>(initialStep);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [survey, setSurvey] = useState<SurveyAnswers>(initialSurvey);
  const [suggestedFamily, setSuggestedFamily] = useState<OccupationFamily | null>(null);
  const [cvUploaded, setCvUploaded] = useState(hasCv);
  const [summary, setSummary] = useState<ProfileSummary | null>(initialSummary);
  const [review, setReview] = useState<CvReview | null>(initialReview);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const order = useMemo(() => flowOrder(survey), [survey]);
  const family = survey.occupationFamily;

  function go(next: FlowStep, within: FlowStep[] = order) {
    setError(null);
    setDirection(within.indexOf(next) >= within.indexOf(step) ? 1 : -1);
    setStep(next);
  }

  function back() {
    if (backTarget) go(backTarget);
  }

  /**
   * Save one answer. `covers` is every step this screen finishes, so a combined
   * screen jumps past all of them instead of stopping on the next old step.
   */
  function answer(patch: SurveyAnswers, covers: FlowStep[] = [step]) {
    const merged = { ...survey, ...patch };
    const nextOrder = flowOrder(merged);
    const next = nextStepAfter(merged, step, covers);
    setSurvey(merged);
    startTransition(async () => {
      const result = await saveSurveyStepAction(patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      go(next, nextOrder);
    });
  }

  const { groupCount, groupIndex, progress } = flowProgress(order, step);
  const backTarget = backTargetFor(order, step);
  const canGoBack = backTarget !== null && step !== "analyzing" && step !== "review";
  const asksForWebsite = family ? FAMILY_PROFILES[family].asksForWebsite : true;
  const asksForLinkedin = family ? FAMILY_PROFILES[family].usesLevels : true;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-8">
      <div className="my-auto flex w-full flex-col">
      <div className="mx-auto mb-8 flex h-9 w-full max-w-lg items-center gap-4">
        {canGoBack ? (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="text-foreground border-input hover:bg-primary hover:text-primary-foreground hover:border-primary -ml-1 grid size-9 shrink-0 place-items-center rounded-full border transition-colors duration-150 ease-standard"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="size-9 shrink-0 -ml-1" aria-hidden />
        )}
        <Stepper
          steps={groupCount}
          current={groupIndex}
          progress={progress}
        />
        {groupIndex >= 0 ? (
          <p className="text-muted-foreground w-12 shrink-0 text-right text-body-sm tabular-nums">
            {groupIndex + 1}/{groupCount}
          </p>
        ) : (
          <span className="w-12 shrink-0" aria-hidden />
        )}
      </div>

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={step}
          className="flex flex-1 flex-col"
          initial={reducedMotion ? false : { opacity: 0, y: 14 * direction, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reducedMotion
              ? undefined
              : { opacity: 0, y: -14 * direction, filter: "blur(3px)", transition: { duration: 0.18, ease: EXIT } }
          }
          transition={{ duration: 0.36, ease: EASE }}
        >
          {step === "intro" || step === "role" ? (
            <RoleStep
              userName={userName}
              initial={survey.role ?? ""}
              pending={pending}
              onPick={(occupation) =>
                answer(
                  {
                    role: occupation.en,
                    occupationId: occupation.id,
                    occupationFamily: occupation.family,
                    occupationSynonyms: occupationSearchTerms(occupation),
                  },
                  ["intro", "role"],
                )
              }
              onUnknown={(role) =>
                startTransition(async () => {
                  const result = await classifyRoleAction(role);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  const { data } = result;
                  if (data.occupationId && data.family) {
                    answer(
                      {
                        role,
                        occupationId: data.occupationId,
                        occupationFamily: data.family,
                        occupationSynonyms: [data.en, data.sr, ...data.synonyms],
                      },
                      ["intro", "role"],
                    );
                    return;
                  }
                  setSuggestedFamily(data.family);
                  answer(
                    {
                      role,
                      occupationId: null,
                      occupationFamily: undefined,
                      occupationSynonyms:
                        data.source === "model" ? [data.en, data.sr, ...data.synonyms] : [],
                    },
                    ["intro", "role"],
                  );
                })
              }
            />
          ) : null}

          {step === "family" ? (
            <Screen
              title="Which area is this job in?"
              hint={
                suggestedFamily
                  ? `We think "${survey.role}" is ${FAMILY_PROFILES[suggestedFamily].label.toLowerCase()}. Pick another area if that's wrong.`
                  : `Pick the area closest to "${survey.role}". It decides where we look and what we ask next.`
              }
            >
              <Choices
                value={survey.occupationFamily ?? suggestedFamily ?? undefined}
                disabled={pending}
                onPick={(occupationFamily) => answer({ occupationFamily })}
                options={OCCUPATION_FAMILIES.map((id) => ({
                  id,
                  label: FAMILY_PROFILES[id].label,
                  detail: FAMILY_PROFILES[id].examples,
                }))}
              />
            </Screen>
          ) : null}

          {step === "experience" || step === "level" || step === "engagement" || step === "workMode" ? (
            <WorkStep
              experience={survey.experience}
              level={survey.level}
              usesLevels={Boolean(family && FAMILY_PROFILES[family].usesLevels)}
              engagement={survey.engagement ?? []}
              workMode={survey.workMode}
              remote={remoteOffered(family)}
              pending={pending}
              onSubmit={(patch) =>
                answer(patch, ["experience", "level", "engagement", "workMode"])
              }
            />
          ) : null}

          {step === "location" || step === "pay" || step === "availability" ? (
            <PlacePayStep
              remote={survey.workMode === "remote"}
              locations={survey.locations ?? []}
              commuteKm={survey.commuteKm ?? null}
              pay={survey.pay ?? null}
              availability={survey.availability}
              freelance={Boolean(survey.engagement?.includes("freelance") || survey.workType === "contract")}
              pending={pending}
              onSubmit={(patch) => answer(patch, ["location", "pay", "availability"])}
            />
          ) : null}

          {step === "details" || step === "languages" || step === "priorities" ? (
            <FitStep
              family={family ?? "office_business"}
              survey={survey}
              pending={pending}
              onSubmit={(patch) =>
                answer({ ...patch, detailsDone: true }, ["details", "languages", "priorities"])
              }
            />
          ) : null}

          {step === "cv" || step === "website" || step === "linkedin" ? (
            <CvStep
              uploaded={cvUploaded}
              askWebsite={asksForWebsite}
              askLinkedin={asksForLinkedin}
              initialWebsite={survey.websiteUrl ?? ""}
              onUploaded={() => setCvUploaded(true)}
              onContinue={async (websiteUrl) => {
                if (websiteUrl) {
                  const result = await saveSurveyStepAction({ websiteUrl });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSurvey((current) => ({ ...current, websiteUrl }));
                }
                go("analyzing");
              }}
            />
          ) : null}

          {step === "analyzing" ? (
            <AnalyzingStep
              hasWebsite={Boolean(survey.websiteUrl)}
              onDone={(result) => {
                setSummary(result.summary);
                setReview(result.review);
                go("summary");
              }}
              onBack={() => go("cv")}
            />
          ) : null}

          {step === "summary" && summary ? (
            <SummaryStep
              summary={summary}
              pending={pending}
              error={error}
              onEdit={() => go("role")}
              onConfirm={() =>
                startTransition(async () => {
                  const result = await confirmProfileAction();
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  go("review");
                })
              }
            />
          ) : null}

          {step === "summary" && !summary ? (
            // Came back after a refresh: re-read sources to rebuild the summary.
            <AnalyzingStep
              hasWebsite={Boolean(survey.websiteUrl)}
              onDone={(result) => {
                setSummary(result.summary);
                setReview(result.review);
              }}
              onBack={() => go("cv")}
            />
          ) : null}

          {step === "review" ? (
            <ReviewStep
              review={review}
              onReviewed={setReview}
              pending={pending}
              error={error}
              onFinish={() =>
                startTransition(async () => {
                  const result = await completeOnboardingAction();
                  if (result && !result.ok) setError(result.error);
                })
              }
            />
          ) : null}

          {error && step !== "summary" && step !== "review" ? (
            <p role="alert" className="text-destructive mt-4 text-center text-body">
              {error}
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
}
