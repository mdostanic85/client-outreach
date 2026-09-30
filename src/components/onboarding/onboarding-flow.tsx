"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { ingestCvAction, ingestPortfolioUrlAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CvScore } from "@/components/onboarding/cv-score";
import { MaterialReader } from "@/components/onboarding/material-reader";
import { cn } from "@/lib/utils";
import {
  analyzeProfileAction,
  classifyRoleAction,
  completeOnboardingAction,
  confirmProfileAction,
  reviewCvAction,
  saveSurveyStepAction,
} from "@/modules/onboarding/actions";
import {
  ENGAGEMENTS,
  ENGAGEMENT_LABELS,
  EXPERIENCE,
  EXPERIENCE_LABELS,
  LANGUAGE_LEVELS,
  PRIORITIES,
  PRIORITY_LABELS,
  remoteOffered,
  surveySteps,
  type ProfileSummary,
  type SurveyAnswers,
  type SurveyStep,
} from "@/modules/onboarding/survey-core";
import type { Occupation } from "@/modules/occupations/catalog";
import {
  FAMILY_PROFILES,
  OCCUPATION_FAMILIES,
  type OccupationFamily,
} from "@/modules/occupations/families";
import {
  findOccupation,
  occupationSearchTerms,
  searchOccupations,
} from "@/modules/occupations/search";
import type { CvReview } from "@/modules/profile/cv-review";
import { roleWithLevel } from "@/modules/profile/schemas";

export type FlowStep =
  | SurveyStep
  | "cv"
  | "website"
  | "linkedin"
  | "analyzing"
  | "summary"
  | "review";

/** Every screen for this person, in order. Changes once we know the family. */
function flowOrder(survey: SurveyAnswers): FlowStep[] {
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
const QUESTION_GROUPS: FlowStep[][] = [
  ["intro", "role"],
  ["family"],
  ["experience", "level", "engagement", "workMode"],
  ["location", "pay", "availability"],
  ["details", "languages", "priorities"],
  ["cv", "website", "linkedin"],
];

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ROLE_SUGGESTIONS = [
  "Software Engineer",
  "Nurse",
  "Accountant",
  "Truck Driver",
  "Electrician",
  "Teacher",
  "Chef",
  "Sales Representative",
];

const REGION_OPTIONS = ["Europe", "United States", "United Kingdom", "Worldwide"];
const PLACE_OPTIONS = ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Anywhere in Serbia", "Abroad (EU)"];

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
    const indexes = covers.map((item) => nextOrder.indexOf(item)).filter((index) => index >= 0);
    const last = indexes.length ? Math.max(...indexes) : nextOrder.indexOf(step);
    const next = nextOrder[last + 1] ?? "cv";
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

  const visibleGroups = QUESTION_GROUPS.map((group) => group.filter((item) => order.includes(item))).filter(
    (group) => group.length > 0,
  );
  const groupIndex = visibleGroups.findIndex((group) => group.includes(step));
  const progress = groupIndex < 0 ? 1 : (groupIndex + 1) / visibleGroups.length;
  const backTarget = (() => {
    const group = QUESTION_GROUPS.find((item) => item.includes(step));
    const first = group?.find((item) => order.includes(item)) ?? step;
    const index = order.indexOf(first);
    return index > 0 ? order[index - 1]! : null;
  })();
  const canGoBack = backTarget !== null && step !== "analyzing" && step !== "review";
  const asksForWebsite = family ? FAMILY_PROFILES[family].asksForWebsite : true;
  const asksForLinkedin = family ? FAMILY_PROFILES[family].usesLevels : true;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-6 sm:px-10">
      <div className="my-auto flex w-full flex-col">
      <div className="mx-auto mb-8 flex h-9 w-full max-w-lg items-center gap-4">
        {canGoBack ? (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="text-muted-foreground hover:text-foreground -ml-2 grid size-9 place-items-center rounded-full transition-colors"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="size-9 -ml-2" aria-hidden />
        )}
        <div
          className="bg-white/15 h-1 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="bg-brand h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {groupIndex >= 0 ? (
          <p className="text-muted-foreground w-12 text-right text-[13px] tabular-nums">
            {groupIndex + 1}/{visibleGroups.length}
          </p>
        ) : (
          <span className="w-12" aria-hidden />
        )}
      </div>

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={step}
          className="flex flex-1 flex-col"
          initial={reducedMotion ? false : { opacity: 0, x: 24 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, x: -24 * direction, transition: { duration: 0.15 } }}
          transition={{ duration: 0.3, ease: EASE }}
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
            <p role="alert" className="text-destructive mt-4 text-center text-[15px]">
              {error}
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
}

function Screen({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {eyebrow ? (
        <p className="text-brand-ink mb-3 text-[13px] font-medium tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="max-w-3xl text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.08] font-medium tracking-tight text-foreground">
        {title}
      </h1>
      {hint ? (
        <p className="text-muted-foreground mt-4 max-w-xl text-[18px] leading-relaxed sm:text-[20px]">{hint}</p>
      ) : null}
      <div className="mt-10 w-full">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
  pending,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  pending?: boolean;
  className?: string;
}) {
  return (
    <Button
      type={type}
      size="lg"
      disabled={disabled || pending}
      onClick={onClick}
      className={cn("mx-auto h-14 w-full max-w-sm rounded-2xl text-[18px]", className)}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
      {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
    </Button>
  );
}

function SkipButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground h-12 px-3 text-[15px] font-medium transition-colors"
    >
      Skip
    </button>
  );
}

/** Single choice. Picking an option saves and advances — no extra Continue click. */
function Choices<T extends string>({
  options,
  value,
  onPick,
  disabled,
}: {
  options: Array<{ id: T; label: string; detail?: string }>;
  value: T | undefined;
  onPick: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn("grid w-full gap-3", options.length > 3 ? "sm:grid-cols-2" : "mx-auto max-w-xl")}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onPick(option.id)}
            className={cn(
              "flex min-h-20 items-center justify-between gap-4 rounded-3xl border-2 px-6 py-4 text-left text-[1.2rem] font-medium transition-colors disabled:opacity-60 sm:min-h-24 sm:text-[1.45rem]",
              selected
                ? "border-brand bg-[color-mix(in_oklch,var(--brand)_42%,#10141c)] font-medium text-foreground"
                : "border-white/25 bg-secondary text-foreground hover:border-white/45",
            )}
          >
            <span className="flex flex-col">
              {option.label}
              {option.detail ? (
                <span className="text-muted-foreground text-[14px] font-normal">{option.detail}</span>
              ) : null}
            </span>
            {selected ? (
              <span className="bg-brand text-white grid size-7 shrink-0 place-items-center rounded-full">
                <Check className="size-4" strokeWidth={2.75} aria-hidden />
              </span>
            ) : (
              <span className="size-7 shrink-0 rounded-full border-2 border-white/25" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full border-2 px-5 text-[16px] font-medium transition-colors disabled:opacity-40",
        selected
          ? "border-brand bg-[color-mix(in_oklch,var(--brand)_42%,#10141c)] font-medium text-foreground"
          : "border-white/25 bg-secondary text-foreground hover:border-white/45",
      )}
    >
      {selected ? <Check className="size-4 shrink-0" strokeWidth={2.75} aria-hidden /> : null}
      {label}
    </button>
  );
}

function RoleStep({
  userName,
  initial,
  pending,
  onPick,
  onUnknown,
}: {
  userName: string | null;
  initial: string;
  pending: boolean;
  onPick: (occupation: Occupation) => void;
  onUnknown: (role: string) => void;
}) {
  const [role, setRole] = useState(initial);
  const trimmed = role.trim();
  const matches = useMemo(() => searchOccupations(trimmed, 6), [trimmed]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    const known = findOccupation(trimmed);
    if (known) onPick(known);
    else onUnknown(trimmed);
  }

  const firstName = userName?.trim().split(" ")[0];
  return (
    <Screen
      title={firstName ? `${firstName}, what job are you looking for?` : "What job are you looking for?"}
      hint="Type the job title in English."
    >
      <form onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <Input
          autoFocus
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="Nurse, truck driver, accountant"
          maxLength={80}
          aria-autocomplete="list"
          className="h-16 rounded-2xl text-center text-[22px]"
        />
        {matches.length > 0 ? (
          <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border-2 border-white/15" role="listbox">
            {matches.map((occupation) => (
              <li key={occupation.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={pending}
                  onClick={() => onPick(occupation)}
                  className="hover:bg-card/70 flex w-full items-center justify-between gap-3 px-5 py-3 text-left disabled:opacity-60"
                >
                  <span className="text-[16px] font-medium text-foreground">{occupation.en}</span>
                  <span className="text-muted-foreground shrink-0 text-[13px]">
                    {FAMILY_PROFILES[occupation.family].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : trimmed.length < 2 ? (
          <div className="flex flex-wrap justify-center gap-3">
            {ROLE_SUGGESTIONS.map((suggestion) => (
              <Chip key={suggestion} label={suggestion} selected={false} onClick={() => setRole(suggestion)} />
            ))}
          </div>
        ) : null}
        <div>
          <PrimaryButton type="submit" disabled={!trimmed} pending={pending}>
            Continue
          </PrimaryButton>
        </div>
      </form>
    </Screen>
  );
}

function Ask({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[18px] font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground mt-1 mb-4 text-[14px]">{hint}</p>
      {children}
    </div>
  );
}

function OptionChips<T extends string>({
  options,
  value,
  onPick,
  disabled,
}: {
  options: Array<{ id: T; label: string }>;
  value: T | undefined;
  onPick: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3" role="radiogroup">
      {options.map((option) => (
        <Chip
          key={option.id}
          label={option.label}
          selected={option.id === value}
          disabled={disabled}
          onClick={() => onPick(option.id)}
        />
      ))}
    </div>
  );
}

function WorkStep({
  experience,
  level,
  usesLevels,
  engagement,
  workMode,
  remote,
  pending,
  onSubmit,
}: {
  experience: SurveyAnswers["experience"];
  level: SurveyAnswers["level"];
  usesLevels: boolean;
  engagement: Array<(typeof ENGAGEMENTS)[number]>;
  workMode: SurveyAnswers["workMode"];
  remote: boolean;
  pending: boolean;
  onSubmit: (patch: Pick<SurveyAnswers, "experience" | "level" | "engagement" | "workMode">) => void;
}) {
  const [years, setYears] = useState(experience);
  const [aim, setAim] = useState(level);
  const [picked, setPicked] = useState(engagement);
  const [place, setPlace] = useState(workMode);

  function toggle(id: (typeof ENGAGEMENTS)[number]) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const places = remote
    ? ([
        { id: "onsite" as const, label: "On-site" },
        { id: "hybrid" as const, label: "Hybrid" },
        { id: "remote" as const, label: "Remote" },
        { id: "any" as const, label: "Any of these" },
      ] as const)
    : ([
        { id: "onsite" as const, label: "On-site" },
        { id: "any" as const, label: "Doesn't matter" },
      ] as const);

  return (
    <Screen title="What kind of work?" hint="A few answers so the list stays relevant.">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-9">
        <Ask title="How long have you done this?" hint="Pick one">
          <OptionChips
            value={years}
            disabled={pending}
            onPick={setYears}
            options={EXPERIENCE.map((id) => ({ id, label: EXPERIENCE_LABELS[id] }))}
          />
        </Ask>
        {usesLevels ? (
          <Ask title="What level are you aiming for?" hint="Pick one">
            <OptionChips
              value={aim}
              disabled={pending}
              onPick={setAim}
              options={[
                { id: "junior", label: "Junior" },
                { id: "mid", label: "Mid-level" },
                { id: "senior", label: "Senior" },
                { id: "lead", label: "Lead" },
                { id: "head", label: "Head or Director" },
              ]}
            />
          </Ask>
        ) : null}
        <Ask title="What are you open to?" hint="Select all that apply">
          <div className="flex flex-wrap justify-center gap-3">
            {ENGAGEMENTS.map((id) => (
              <Chip
                key={id}
                label={ENGAGEMENT_LABELS[id]}
                selected={picked.includes(id)}
                disabled={pending}
                onClick={() => toggle(id)}
              />
            ))}
          </div>
        </Ask>
        <Ask title="Where do you want to work?" hint="Pick one">
          <OptionChips value={place} disabled={pending} onPick={setPlace} options={[...places]} />
        </Ask>
        <PrimaryButton
          disabled={!years || (usesLevels && !aim) || picked.length === 0 || !place}
          pending={pending}
          onClick={() => place && onSubmit({ experience: years, level: aim, engagement: picked, workMode: place })}
        >
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}

const COMMUTE_OPTIONS: Array<{ km: number | null; label: string }> = [
  { km: 10, label: "Up to 10 km" },
  { km: 25, label: "Up to 25 km" },
  { km: 50, label: "Up to 50 km" },
  { km: null, label: "Doesn't matter" },
];

function PlacePayStep({
  remote,
  locations,
  commuteKm,
  pay,
  availability,
  freelance,
  pending,
  onSubmit,
}: {
  remote: boolean;
  locations: string[];
  commuteKm: number | null;
  pay: SurveyAnswers["pay"];
  availability: SurveyAnswers["availability"];
  freelance: boolean;
  pending: boolean;
  onSubmit: (patch: Pick<SurveyAnswers, "locations" | "commuteKm" | "pay" | "availability">) => void;
}) {
  const base = remote ? REGION_OPTIONS : PLACE_OPTIONS;
  const [picked, setPicked] = useState<string[]>(locations);
  const [custom, setCustom] = useState("");
  const [commute, setCommute] = useState<number | null>(commuteKm);
  const options = [...base, ...picked.filter((p) => !base.includes(p))];
  const serbia = picked.some((place) => /serbia|belgrade|novi sad|ni[sš]|kragujevac/i.test(place));
  const [mode, setMode] = useState<PayMode>(pay?.mode ?? (freelance ? "hourly" : serbia ? "monthly" : "salary"));
  const [currency, setCurrency] = useState<Currency>(pay?.currency ?? (serbia ? "RSD" : "EUR"));
  const [amount, setAmount] = useState(pay?.min ? String(pay.min) : "");
  const [start, setStart] = useState(availability);
  const value = Number(amount.replace(/[^\d.]/g, ""));
  const valid = Number.isFinite(value) && value > 0;

  function toggle(location: string) {
    setPicked((prev) =>
      prev.includes(location) ? prev.filter((p) => p !== location) : [...prev, location].slice(0, 8),
    );
  }

  function addCustom(event: FormEvent) {
    event.preventDefault();
    const value = custom.trim();
    if (value && !picked.includes(value)) setPicked((prev) => [...prev, value].slice(0, 8));
    setCustom("");
  }

  /** "Anywhere in Serbia" / "Abroad (EU)" are labels; search uses plain places. */
  function forSearch(locations: string[]): string[] {
    return locations.map((l) => (l === "Anywhere in Serbia" ? "Serbia" : l === "Abroad (EU)" ? "Europe" : l));
  }

  function finish(nextPay: SurveyAnswers["pay"]) {
    if (!start || picked.length === 0) return;
    onSubmit({
      locations: forSearch(picked),
      commuteKm: remote ? null : commute,
      pay: nextPay,
      availability: start,
    });
  }

  const placeholder =
    mode === "hourly" ? "e.g. 15" : mode === "monthly" ? (currency === "RSD" ? "e.g. 120000" : "e.g. 1500") : "e.g. 40000";

  return (
    <Screen title="Where, and what pay?" hint="Pick every place that works. The number stays private.">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-9">
      <Ask title={remote ? "Which regions?" : "Which places?"} hint="Select all that apply">
      <div className="flex flex-wrap justify-center gap-3">
        {options.map((location) => (
          <Chip key={location} label={location} selected={picked.includes(location)} onClick={() => toggle(location)} />
        ))}
      </div>
      <form onSubmit={addCustom} className="mt-5 flex gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder={remote ? "Add a country or region" : "Add a city or country"}
          maxLength={60}
          className="h-12 rounded-xl"
        />
        <Button type="submit" variant="outline" size="lg" className="h-12 rounded-xl" disabled={!custom.trim()}>
          Add
        </Button>
      </form>
      </Ask>
      {!remote ? (
        <Ask title="How far can you commute?" hint="Pick one">
          <div className="flex flex-wrap justify-center gap-3">
            {COMMUTE_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={commute === option.km}
                onClick={() => setCommute(option.km)}
              />
            ))}
          </div>
        </Ask>
      ) : null}
      <Ask title="Minimum pay" hint={mode === "monthly" ? "Per month, after tax. Or skip the number." : "Or skip the number."}>
        <div className="flex flex-wrap justify-center gap-3">
          <Chip label="Per month" selected={mode === "monthly"} onClick={() => setMode("monthly")} />
          <Chip label="Per year" selected={mode === "salary"} onClick={() => setMode("salary")} />
          <Chip label="Per hour" selected={mode === "hourly"} onClick={() => setMode("hourly")} />
        </div>
        <div className="mt-4 flex gap-3">
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            aria-label="Currency"
            className="border-white/25 bg-secondary h-14 rounded-2xl border-2 px-4 text-[16px]"
          >
            {(["EUR", "USD", "GBP", "CHF", "RSD"] as const).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={placeholder}
            className="h-14 rounded-2xl text-center text-[20px]"
          />
        </div>
      </Ask>
      <Ask title="When could you start?" hint="Pick one">
        <OptionChips
          value={start}
          disabled={pending}
          onPick={setStart}
          options={[
            { id: "now", label: "Right away" },
            { id: "soon", label: "In 1–2 months" },
            { id: "exploring", label: "Just looking for now" },
          ]}
        />
      </Ask>
      <div className="flex flex-col items-center gap-3">
        <PrimaryButton
          disabled={picked.length === 0 || !start || (amount.trim().length > 0 && !valid)}
          pending={pending}
          onClick={() => finish(valid ? { mode, currency, min: value } : null)}
        >
          Continue
        </PrimaryButton>
        <button
          type="button"
          onClick={() => finish(null)}
          disabled={pending || !start || picked.length === 0}
          className="text-muted-foreground hover:text-foreground h-12 px-3 text-[16px] font-medium transition-colors"
        >
          Skip the pay
        </button>
      </div>
      </div>
    </Screen>
  );
}

type PayMode = "salary" | "monthly" | "hourly";
type Currency = "EUR" | "USD" | "GBP" | "CHF" | "RSD";

type Details = Pick<
  SurveyAnswers,
  | "licenses"
  | "tachographCard"
  | "internationalRoutes"
  | "professionalLicense"
  | "shifts"
  | "nights"
  | "weekends"
  | "sanitaryBook"
  | "ownTools"
  | "certifications"
  | "stack"
>;

const LICENCE_CATEGORIES = ["B", "C", "CE", "D", "C1", "ADR"];

/** A yes/no chip: selected = yes. */
function Toggle({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return <Chip label={label} selected={Boolean(value)} onClick={() => onChange(!value)} />;
}

/** Free-text list: type and press Enter / Add. */
function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(event: FormEvent) {
    event.preventDefault();
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v].slice(0, 20));
    setDraft("");
  }

  return (
    <div>
      <p className="mb-3 text-[15px] font-medium">{label}</p>
      {values.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="border-brand bg-brand/12 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium"
              aria-label={`Remove ${v}`}
            >
              {v}
              <X className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={add} className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          maxLength={60}
          className="h-12 rounded-xl"
        />
        <Button type="submit" variant="outline" size="lg" className="h-12 rounded-xl" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

/** The questions that only matter for this family of jobs. */
function FitStep({
  family,
  survey,
  pending,
  onSubmit,
}: {
  family: OccupationFamily;
  survey: SurveyAnswers;
  pending: boolean;
  onSubmit: (patch: Details & Pick<SurveyAnswers, "languages" | "priorities">) => void;
}) {
  const [d, setD] = useState<Details>({
    licenses: survey.licenses ?? [],
    tachographCard: survey.tachographCard,
    internationalRoutes: survey.internationalRoutes,
    professionalLicense: survey.professionalLicense,
    shifts: survey.shifts,
    nights: survey.nights,
    weekends: survey.weekends,
    sanitaryBook: survey.sanitaryBook,
    ownTools: survey.ownTools,
    certifications: survey.certifications ?? [],
    stack: survey.stack ?? [],
  });
  const set = (patch: Details) => setD((prev) => ({ ...prev, ...patch }));
  const licences = d.licenses ?? [];
  const [rows, setRows] = useState<LanguageAnswer[]>(survey.languages ?? []);
  const [priorities, setPriorities] = useState<Priority[]>(survey.priorities ?? []);
  const [languageDraft, setLanguageDraft] = useState("");
  const priorityFull = priorities.length >= 3;
  const hasLanguage = (name: string) => rows.some((row) => row.language.toLowerCase() === name.toLowerCase());

  function addLanguage(language: string) {
    const name = language.trim();
    if (!name || hasLanguage(name)) return;
    setRows((prev) => [...prev, { language: name, level: "conversational" as const }].slice(0, 8));
  }

  function togglePriority(id: Priority) {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : priorityFull ? prev : [...prev, id],
    );
  }

  const schedule = (
    <div>
      <p className="mb-1 text-[15px] font-medium">I can work</p>
      <p className="text-muted-foreground mb-3 text-[14px]">Select all that apply</p>
      <div className="flex flex-wrap gap-2">
        <Toggle label="Shifts" value={d.shifts} onChange={(shifts) => set({ shifts })} />
        <Toggle label="Nights" value={d.nights} onChange={(nights) => set({ nights })} />
        <Toggle label="Weekends" value={d.weekends} onChange={(weekends) => set({ weekends })} />
      </div>
    </div>
  );

  /** Unselected schedule chips mean "no" once the question was shown. */
  function submit() {
    const asksSchedule = family === "healthcare" || family === "hospitality_retail" || family === "transport_logistics";
    onSubmit({
      ...d,
      ...(asksSchedule ? { shifts: Boolean(d.shifts), nights: Boolean(d.nights), weekends: Boolean(d.weekends) } : {}),
      languages: rows,
      priorities,
    });
  }

  const content: Record<OccupationFamily, { title: string; body: ReactNode }> = {
    transport_logistics: {
      title: "Licences and routes",
      body: (
        <>
          <div>
            <p className="mb-1 text-[15px] font-medium">Driving licence categories</p>
            <p className="text-muted-foreground mb-3 text-[14px]">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {LICENCE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  selected={licences.includes(cat)}
                  onClick={() =>
                    set({ licenses: licences.includes(cat) ? licences.filter((l) => l !== cat) : [...licences, cat] })
                  }
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a tachograph card" value={d.tachographCard} onChange={(tachographCard) => set({ tachographCard })} />
            <Toggle label="International routes are fine" value={d.internationalRoutes} onChange={(internationalRoutes) => set({ internationalRoutes })} />
          </div>
          {schedule}
        </>
      ),
    },
    healthcare: {
      title: "Licence and schedule",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a valid licence to work" value={d.professionalLicense} onChange={(professionalLicense) => set({ professionalLicense })} />
          </div>
          {schedule}
          <TagInput label="Certificates (optional)" placeholder="e.g. BLS, ICU course" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
        </>
      ),
    },
    hospitality_retail: {
      title: "Schedule and papers",
      body: (
        <>
          {schedule}
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a sanitary booklet" value={d.sanitaryBook} onChange={(sanitaryBook) => set({ sanitaryBook })} />
          </div>
        </>
      ),
    },
    trades: {
      title: "Certificates and tools",
      body: (
        <>
          <TagInput label="Certificates" placeholder="e.g. EN ISO 9606-1, electrical licence" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have my own tools" value={d.ownTools} onChange={(ownTools) => set({ ownTools })} />
          </div>
        </>
      ),
    },
    tech_digital: {
      title: "Your stack",
      body: (
        <TagInput label="Languages, frameworks and tools you use most" placeholder="e.g. React, Python, Figma" values={d.stack ?? []} onChange={(stack) => set({ stack })} />
      ),
    },
    office_business: {
      title: "Software and certificates",
      body: (
        <>
          <TagInput label="Software you use" placeholder="e.g. Excel, SAP, Salesforce" values={d.stack ?? []} onChange={(stack) => set({ stack })} />
          <TagInput label="Certificates (optional)" placeholder="e.g. ACCA, PMP" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
        </>
      ),
    },
    education: {
      title: "Licence and certificates",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a teaching licence" value={d.professionalLicense} onChange={(professionalLicense) => set({ professionalLicense })} />
          </div>
          <TagInput label="Certificates (optional)" placeholder="e.g. CELTA, Montessori" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
        </>
      ),
    },
  };

  return (
    <Screen title={content[family].title} hint="Only what this kind of job usually needs. Languages and priorities are optional.">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        {content[family].body}
        <Ask title="Languages you can work in" hint="Select all that apply. Set a level after you add one.">
          <div className="flex flex-wrap justify-center gap-3">
            {LANGUAGE_SUGGESTIONS.filter((language) => !hasLanguage(language)).map((language) => (
              <Chip key={language} label={language} selected={false} onClick={() => addLanguage(language)} />
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addLanguage(languageDraft);
              setLanguageDraft("");
            }}
            className="mt-4 flex gap-2"
          >
            <Input
              value={languageDraft}
              onChange={(event) => setLanguageDraft(event.target.value)}
              placeholder="Another language"
              maxLength={40}
              className="h-12 rounded-xl"
            />
            <Button type="submit" variant="outline" size="lg" className="h-12 rounded-xl" disabled={!languageDraft.trim()}>
              Add
            </Button>
          </form>
          {rows.length ? (
            <ul className="mt-4 divide-y divide-white/10 rounded-2xl border-2 border-white/15">
              {rows.map((row) => (
                <li key={row.language} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[16px] font-medium">{row.language}</span>
                  <span className="flex items-center gap-2">
                    <select
                      value={row.level}
                      aria-label={`${row.language} level`}
                      onChange={(event) =>
                        setRows((prev) =>
                          prev.map((item) =>
                            item.language === row.language
                              ? { ...item, level: event.target.value as LanguageAnswer["level"] }
                              : item,
                          ),
                        )
                      }
                      className="border-white/25 bg-secondary h-10 rounded-xl border-2 px-3 text-[15px]"
                    >
                      {LANGUAGE_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {LANGUAGE_LEVEL_LABELS[level]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove ${row.language}`}
                      onClick={() => setRows((prev) => prev.filter((item) => item.language !== row.language))}
                      className="text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-full"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Ask>
        <Ask title="What matters most?" hint="Pick up to 3">
          <div className="flex flex-wrap justify-center gap-3">
            {prioritiesFor(family).map((id) => (
              <Chip
                key={id}
                label={PRIORITY_LABELS[id]}
                selected={priorities.includes(id)}
                disabled={priorityFull && !priorities.includes(id)}
                onClick={() => togglePriority(id)}
              />
            ))}
          </div>
        </Ask>
        <PrimaryButton pending={pending} onClick={submit}>
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}

type LanguageAnswer = NonNullable<SurveyAnswers["languages"]>[number];
type Priority = (typeof PRIORITIES)[number];

const LANGUAGE_SUGGESTIONS = ["Serbian", "English", "German", "Russian", "Hungarian", "French", "Italian"];
const LANGUAGE_LEVEL_LABELS: Record<(typeof LANGUAGE_LEVELS)[number], string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native",
};


/** "Great product" is a tech concern; commute and schedule matter on-site. */
function prioritiesFor(family: OccupationFamily | undefined): Priority[] {
  const remote = remoteOffered(family);
  return PRIORITIES.filter((p) => {
    if (p === "product") return family === "tech_digital";
    if (p === "close_to_home" || p === "fixed_schedule") return !remote;
    return true;
  });
}

function useFileUpload(kind: "cv" | "linkedin_text", onUploaded: (name: string) => void) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is over 8 MB. Export a smaller PDF.");
      return;
    }
    if (!/\.(pdf|txt|md)$/i.test(file.name)) {
      setError("Upload a PDF.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", kind);
    startTransition(async () => {
      const result = await ingestCvAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUploaded(file.name);
    });
  }

  return { upload, pending, error };
}

function DropZone({
  title,
  hint,
  doneLabel,
  pending,
  onFile,
  compact,
}: {
  title: string;
  hint: string;
  doneLabel: string | null;
  pending: boolean;
  onFile: (file: File | undefined) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFile(event.dataTransfer.files[0]);
      }}
      disabled={pending}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-colors",
        compact ? "px-6 py-10" : "min-h-64 px-6 py-16 sm:min-h-72 sm:py-20",
        dragging ? "border-brand bg-brand/10" : "border-white/25 bg-card/30 hover:border-brand/50",
        doneLabel && "border-brand/60 border-solid",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {pending ? (
        <Loader2 className="text-brand-ink size-10 animate-spin" aria-hidden />
      ) : doneLabel ? (
        <FileText className="text-brand-ink size-10" aria-hidden />
      ) : (
        <UploadCloud className="text-muted-foreground size-10" aria-hidden />
      )}
      <span className="text-[22px] font-medium text-foreground">
        {pending ? "Reading your file…" : doneLabel ?? title}
      </span>
      <span className="text-muted-foreground text-[14px]">{doneLabel ? "Click to replace" : hint}</span>
    </button>
  );
}

function CvStep({
  uploaded,
  askWebsite,
  askLinkedin,
  initialWebsite,
  onUploaded,
  onContinue,
}: {
  uploaded: boolean;
  askWebsite: boolean;
  askLinkedin: boolean;
  initialWebsite: string;
  onUploaded: () => void;
  onContinue: (websiteUrl?: string) => Promise<void>;
}) {
  const [fileName, setFileName] = useState<string | null>(uploaded ? "CV uploaded" : null);
  const [website, setWebsite] = useState(initialWebsite);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const { upload, pending, error } = useFileUpload("cv", (name) => {
    setFileName(name);
    onUploaded();
  });
  const [linkedinName, setLinkedinName] = useState<string | null>(null);
  const linkedin = useFileUpload("linkedin_text", setLinkedinName);

  function finish() {
    const url = website.trim();
    startBusy(async () => {
      if (askWebsite && url) {
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        const result = await ingestPortfolioUrlAction(normalized);
        if (!result.ok) {
          setSiteError("We couldn't open that site. Check the address, or leave it blank.");
          return;
        }
        await onContinue(normalized);
        return;
      }
      await onContinue(undefined);
    });
  }

  return (
    <Screen title="Your CV" hint="PDF works best. A site or LinkedIn export is optional.">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <DropZone
          title="Drop your CV here"
          hint="or click to choose a PDF"
          doneLabel={fileName}
          pending={pending}
          onFile={upload}
        />
        {error ? <p role="alert" className="text-destructive text-[15px]">{error}</p> : null}
        {askWebsite ? (
          <Input
            value={website}
            onChange={(event) => {
              setWebsite(event.target.value);
              setSiteError(null);
            }}
            placeholder="yourname.com — optional"
            inputMode="url"
            className="h-16 rounded-2xl text-center text-[20px]"
          />
        ) : null}
        {siteError ? <p role="alert" className="text-destructive text-[15px]">{siteError}</p> : null}
        {askLinkedin ? (
          <DropZone
            compact
            title="LinkedIn PDF, if you have one"
            hint="More → Save to PDF. Optional."
            doneLabel={linkedinName}
            pending={linkedin.pending}
            onFile={linkedin.upload}
          />
        ) : null}
        {linkedin.error ? <p role="alert" className="text-destructive text-[15px]">{linkedin.error}</p> : null}
        <PrimaryButton disabled={!fileName || pending || busy || linkedin.pending} onClick={finish}>
          {busy ? "Opening your site…" : "Analyze"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}

function AnalyzingStep({
  hasWebsite,
  onDone,
  onBack,
}: {
  hasWebsite: boolean;
  onDone: (result: { summary: ProfileSummary; review: CvReview | null }) => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    void analyzeProfileAction().then((result) => {
      if (!result.ok) setError(result.error);
      else onDone(result);
    });
  }, [attempt, onDone]);

  if (error) {
    return (
      <Screen title="That didn't work" hint={error}>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <PrimaryButton
            onClick={() => {
              setError(null);
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </PrimaryButton>
          <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground h-12 px-3 text-[15px] font-medium">
            Change files
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Reading your material">
      <MaterialReader hasWebsite={hasWebsite} />
    </Screen>
  );
}

function SummaryStep({
  summary,
  pending,
  error,
  onEdit,
  onConfirm,
}: {
  summary: ProfileSummary;
  pending: boolean;
  error: string | null;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const where = summary.where
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const rows: Array<{ label: string; value?: string | null; chips?: string[] }> = [
    { label: "Role", value: roleWithLevel(summary.level, summary.role) || null },
    { label: "Experience", value: summary.years ? `${summary.years} years` : null },
    { label: "Strongest skills", chips: summary.skills },
    { label: "Licences", chips: summary.licenses },
    { label: "Where", chips: where },
    { label: "Minimum pay", value: summary.pay },
  ];
  const visible = rows.filter((row) => row.value || row.chips?.length);

  return (
    <Screen title="Here's what we understood" hint="We'll search for roles based on this. You can change it anytime on your Profile.">
      <dl className="mx-auto w-full max-w-2xl text-left">
        {visible.map((row, index) => (
          <div
            key={row.label}
            className={cn(
              "grid grid-cols-1 gap-2 py-5 sm:grid-cols-[11rem_1fr] sm:items-start sm:gap-8",
              index > 0 && "border-t border-white/10",
            )}
          >
            <dt className="text-muted-foreground text-[14px] tracking-[0.04em] sm:pt-1.5 sm:text-right">
              {row.label}
            </dt>
            <dd>
              {row.chips?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {row.chips.map((chip) => (
                    <li
                      key={chip}
                      className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[15px] leading-none text-foreground ring-1 ring-white/10"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[18px] leading-snug text-foreground">{row.value}</p>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {error ? (
        <p role="alert" className="text-destructive mt-4 text-[15px]">
          {error}
        </p>
      ) : null}
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
        <PrimaryButton className="sm:mx-0 sm:w-56" pending={pending} onClick={onConfirm}>
          {pending ? "Setting up your search…" : "Looks right"}
        </PrimaryButton>
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground h-14 px-4 text-[16px] font-medium disabled:opacity-60"
        >
          Change answers
        </button>
      </div>
    </Screen>
  );
}

function ReviewStep({
  review,
  onReviewed,
  pending,
  error,
  onFinish,
}: {
  review: CvReview | null;
  onReviewed: (review: CvReview) => void;
  pending: boolean;
  error: string | null;
  onFinish: () => void;
}) {
  const [retrying, startRetry] = useTransition();
  const [retryError, setRetryError] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <p className="text-brand-ink mb-3 text-center text-[13px] font-medium tracking-[0.14em] uppercase">
        Your CV score
      </p>
      {review ? (
        <CvScore review={review} />
      ) : (
        <div className="border-border rounded-2xl border px-5 py-6 text-center">
          <p className="text-[16px]">We couldn&apos;t score your CV this time.</p>
          {retryError ? <p className="text-destructive mt-2 text-[14px]">{retryError}</p> : null}
          <Button
            variant="outline"
            className="mt-4"
            disabled={retrying}
            onClick={() =>
              startRetry(async () => {
                const result = await reviewCvAction();
                if (result.ok) onReviewed(result.review);
                else setRetryError(result.error);
              })
            }
          >
            {retrying ? "Scoring…" : "Try again"}
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-destructive mt-4 text-center text-[14px]">
          {error}
        </p>
      ) : null}
      <div className="mt-10 flex justify-center">
        <PrimaryButton pending={pending} onClick={onFinish}>
          {pending ? "Opening your jobs…" : "See my jobs"}
        </PrimaryButton>
      </div>
    </div>
  );
}
