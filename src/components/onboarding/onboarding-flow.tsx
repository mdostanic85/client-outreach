"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { ingestCvAction, ingestPortfolioUrlAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CvScore } from "@/components/onboarding/cv-score";
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
    const idx = order.indexOf(step);
    if (idx > 0) go(order[idx - 1]!);
  }

  /** Save one answer, then move to the next screen of the (possibly new) order. */
  function answer(patch: SurveyAnswers) {
    const merged = { ...survey, ...patch };
    const nextOrder = flowOrder(merged);
    const next = nextOrder[nextOrder.indexOf(step) + 1] ?? "cv";
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

  const questionSteps = order.slice(1, order.indexOf("analyzing"));
  const questionIndex = questionSteps.indexOf(step);
  const progress =
    step === "intro"
      ? 0
      : questionIndex >= 0
        ? (questionIndex + 1) / questionSteps.length
        : 1;
  const canGoBack = step !== "intro" && step !== "analyzing" && step !== "review";
  const afterCv = order[order.indexOf("cv") + 1] ?? "analyzing";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-12">
      <div className="mb-10 flex h-9 items-center gap-4 sm:mb-14">
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
          className="bg-border h-1 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
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
          {step === "intro" ? (
            <Screen
              eyebrow="About 3 minutes"
              title={`${userName?.trim() ? `Hi, ${userName.trim().split(" ")[0]}. ` : ""}Let's find jobs that fit you.`}
              hint="A few quick questions, then your CV. At the end you get an honest score for your CV and what to fix first."
            >
              <PrimaryButton onClick={() => go("role")}>Start</PrimaryButton>
            </Screen>
          ) : null}

          {step === "role" ? (
            <RoleStep
              initial={survey.role ?? ""}
              pending={pending}
              onPick={(occupation) =>
                answer({
                  role: occupation.en,
                  occupationId: occupation.id,
                  occupationFamily: occupation.family,
                  occupationSynonyms: occupationSearchTerms(occupation),
                })
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
                    answer({
                      role,
                      occupationId: data.occupationId,
                      occupationFamily: data.family,
                      occupationSynonyms: [data.en, data.sr, ...data.synonyms],
                    });
                    return;
                  }
                  setSuggestedFamily(data.family);
                  // No family yet: the next screen asks the person to confirm it.
                  answer({
                    role,
                    occupationId: null,
                    occupationFamily: undefined,
                    occupationSynonyms:
                      data.source === "model" ? [data.en, data.sr, ...data.synonyms] : [],
                  });
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

          {step === "experience" ? (
            <Screen title="How much experience do you have in this job?">
              <Choices
                value={survey.experience}
                disabled={pending}
                onPick={(experience) => answer({ experience })}
                options={EXPERIENCE.map((id) => ({ id, label: EXPERIENCE_LABELS[id] }))}
              />
            </Screen>
          ) : null}

          {step === "level" ? (
            <Screen title="What level are you aiming for?">
              <Choices
                value={survey.level}
                disabled={pending}
                onPick={(level) => answer({ level })}
                options={[
                  { id: "junior", label: "Junior" },
                  { id: "mid", label: "Mid-level" },
                  { id: "senior", label: "Senior" },
                  { id: "lead", label: "Lead" },
                  { id: "head", label: "Head or Director" },
                ]}
              />
            </Screen>
          ) : null}

          {step === "engagement" ? (
            <EngagementStep
              initial={survey.engagement ?? []}
              pending={pending}
              onSubmit={(engagement) => answer({ engagement })}
            />
          ) : null}

          {step === "workMode" ? (
            <Screen title="Where do you want to work?">
              <Choices
                value={survey.workMode}
                disabled={pending}
                onPick={(workMode) => answer({ workMode })}
                options={
                  remoteOffered(family)
                    ? [
                        { id: "onsite", label: "At the workplace" },
                        { id: "hybrid", label: "Hybrid" },
                        { id: "remote", label: "Remote only" },
                        { id: "any", label: "Any of these" },
                      ]
                    : [
                        { id: "onsite", label: "At the workplace" },
                        { id: "any", label: "Doesn't matter" },
                      ]
                }
              />
            </Screen>
          ) : null}

          {step === "location" ? (
            <LocationStep
              remote={survey.workMode === "remote"}
              initial={survey.locations ?? []}
              initialCommute={survey.commuteKm ?? null}
              pending={pending}
              onSubmit={(locations, commuteKm) => answer({ locations, commuteKm })}
            />
          ) : null}

          {step === "pay" ? (
            <PayStep
              initial={survey.pay ?? null}
              serbia={(survey.locations ?? []).some((l) => /serbia|belgrade|novi sad|ni[sš]|kragujevac/i.test(l))}
              freelance={Boolean(survey.engagement?.includes("freelance") || survey.workType === "contract")}
              pending={pending}
              onSubmit={(pay) => answer({ pay })}
            />
          ) : null}

          {step === "availability" ? (
            <Screen title="When could you start?">
              <Choices
                value={survey.availability}
                disabled={pending}
                onPick={(availability) => answer({ availability })}
                options={[
                  { id: "now", label: "Right away" },
                  { id: "soon", label: "In 1–2 months" },
                  { id: "exploring", label: "Just looking for now" },
                ]}
              />
            </Screen>
          ) : null}

          {step === "details" ? (
            <DetailsStep
              family={family ?? "office_business"}
              survey={survey}
              pending={pending}
              onSubmit={(details) => answer({ ...details, detailsDone: true })}
            />
          ) : null}

          {step === "languages" ? (
            <LanguagesStep
              initial={survey.languages ?? []}
              pending={pending}
              onSubmit={(languages) => answer({ languages })}
            />
          ) : null}

          {step === "priorities" ? (
            <PrioritiesStep
              family={family}
              initial={survey.priorities ?? []}
              pending={pending}
              onSubmit={(priorities) => answer({ priorities })}
            />
          ) : null}

          {step === "cv" ? (
            <CvStep
              uploaded={cvUploaded}
              onUploaded={() => setCvUploaded(true)}
              onContinue={() => go(afterCv)}
            />
          ) : null}

          {step === "website" ? (
            <WebsiteStep
              initialWebsite={survey.websiteUrl ?? ""}
              onDone={(websiteUrl) => answer({ websiteUrl })}
            />
          ) : null}

          {step === "linkedin" ? <LinkedinStep onDone={() => go("analyzing")} /> : null}

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
            <p role="alert" className="text-destructive mt-4 text-[14px]">
              {error}
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
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
    <div className="flex flex-col">
      {eyebrow ? (
        <p className="text-primary mb-3 text-[13px] font-medium tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-[clamp(1.75rem,4.5vw,2.4rem)] leading-[1.12] font-semibold tracking-tight text-[var(--card-foreground)]">
        {title}
      </h1>
      {hint ? (
        <p className="text-muted-foreground mt-3 text-[16px] leading-relaxed">{hint}</p>
      ) : null}
      <div className="mt-9">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
  pending,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  pending?: boolean;
}) {
  return (
    <Button
      type={type}
      size="lg"
      disabled={disabled || pending}
      onClick={onClick}
      className="h-12 w-full rounded-xl text-[15px] sm:w-auto sm:min-w-[11rem]"
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
    <div className="flex flex-col gap-3" role="radiogroup">
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
              "flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-5 py-3 text-left text-[16px] font-medium transition-colors disabled:opacity-60",
              selected
                ? "border-primary bg-primary/10 text-[var(--card-foreground)]"
                : "border-border bg-card/40 hover:border-primary/50 hover:bg-card/70",
            )}
          >
            <span className="flex flex-col">
              {option.label}
              {option.detail ? (
                <span className="text-muted-foreground text-[14px] font-normal">{option.detail}</span>
              ) : null}
            </span>
            {selected ? <Check className="text-primary size-5 shrink-0" aria-hidden /> : null}
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
        "h-11 rounded-full border px-4 text-[15px] font-medium transition-colors disabled:opacity-40",
        selected
          ? "border-primary bg-primary/12 text-[var(--card-foreground)]"
          : "border-border bg-card/40 hover:border-primary/50",
      )}
    >
      {label}
    </button>
  );
}

function RoleStep({
  initial,
  pending,
  onPick,
  onUnknown,
}: {
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

  return (
    <Screen
      title="What job are you looking for?"
      hint="Type it the way you'd say it, in English or Serbian. You can add more later."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          autoFocus
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="e.g. Nurse, Vozač C kategorije, Accountant"
          maxLength={80}
          aria-autocomplete="list"
          className="h-14 rounded-2xl text-[17px]"
        />
        {matches.length > 0 ? (
          <ul className="border-border divide-border divide-y overflow-hidden rounded-2xl border" role="listbox">
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
                  <span className="flex flex-col">
                    <span className="text-[16px] font-medium text-[var(--card-foreground)]">{occupation.en}</span>
                    <span className="text-muted-foreground text-[14px]">{occupation.sr}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[13px]">
                    {FAMILY_PROFILES[occupation.family].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : trimmed.length < 2 ? (
          <div className="flex flex-wrap gap-2">
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

function EngagementStep({
  initial,
  pending,
  onSubmit,
}: {
  initial: Array<(typeof ENGAGEMENTS)[number]>;
  pending: boolean;
  onSubmit: (engagement: Array<(typeof ENGAGEMENTS)[number]>) => void;
}) {
  const [picked, setPicked] = useState(initial.length ? initial : (["full_time"] as typeof initial));

  function toggle(id: (typeof ENGAGEMENTS)[number]) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <Screen title="What kind of work are you open to?" hint="Pick all that apply.">
      <div className="flex flex-wrap gap-2">
        {ENGAGEMENTS.map((id) => (
          <Chip key={id} label={ENGAGEMENT_LABELS[id]} selected={picked.includes(id)} onClick={() => toggle(id)} />
        ))}
      </div>
      <div className="mt-8">
        <PrimaryButton disabled={picked.length === 0} pending={pending} onClick={() => onSubmit(picked)}>
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

function LocationStep({
  remote,
  initial,
  initialCommute,
  pending,
  onSubmit,
}: {
  remote: boolean;
  initial: string[];
  initialCommute: number | null;
  pending: boolean;
  onSubmit: (locations: string[], commuteKm: number | null) => void;
}) {
  const base = remote ? REGION_OPTIONS : PLACE_OPTIONS;
  const [picked, setPicked] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");
  const [commute, setCommute] = useState<number | null>(initialCommute);
  const options = [...base, ...picked.filter((p) => !base.includes(p))];

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

  return (
    <Screen
      title={remote ? "Which regions can you work for?" : "Where should the job be?"}
      hint={remote ? "Pick any that apply." : "Pick your city or add another one."}
    >
      <div className="flex flex-wrap gap-2">
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
      {!remote ? (
        <div className="mt-8">
          <p className="mb-3 text-[15px] font-medium">How far can you commute?</p>
          <div className="flex flex-wrap gap-2">
            {COMMUTE_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={commute === option.km}
                onClick={() => setCommute(option.km)}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-8">
        <PrimaryButton
          disabled={picked.length === 0}
          pending={pending}
          onClick={() => onSubmit(forSearch(picked), remote ? null : commute)}
        >
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}

type PayMode = "salary" | "monthly" | "hourly";
type Currency = "EUR" | "USD" | "GBP" | "CHF" | "RSD";

function PayStep({
  initial,
  serbia,
  freelance,
  pending,
  onSubmit,
}: {
  initial: SurveyAnswers["pay"];
  serbia: boolean;
  freelance: boolean;
  pending: boolean;
  onSubmit: (pay: SurveyAnswers["pay"]) => void;
}) {
  // Serbia: monthly net in RSD. Elsewhere: yearly gross, or hourly for freelance.
  const [mode, setMode] = useState<PayMode>(
    initial?.mode ?? (freelance ? "hourly" : serbia ? "monthly" : "salary"),
  );
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? (serbia ? "RSD" : "EUR"));
  const [amount, setAmount] = useState(initial?.min ? String(initial.min) : "");
  const value = Number(amount.replace(/[^\d.]/g, ""));
  const valid = Number.isFinite(value) && value > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSubmit({ mode, currency, min: value });
  }

  const placeholder =
    mode === "hourly" ? "e.g. 15" : mode === "monthly" ? (currency === "RSD" ? "e.g. 120000" : "e.g. 1500") : "e.g. 40000";

  return (
    <Screen
      title="What's the lowest pay you'd accept?"
      hint={
        mode === "monthly"
          ? "Monthly, after tax. Used to skip jobs that pay too little. Only you see this."
          : "Used to skip jobs that pay too little. Only you see this."
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <Chip label="Per month" selected={mode === "monthly"} onClick={() => setMode("monthly")} />
          <Chip label="Per year" selected={mode === "salary"} onClick={() => setMode("salary")} />
          <Chip label="Per hour" selected={mode === "hourly"} onClick={() => setMode("hourly")} />
        </div>
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            aria-label="Currency"
            className="border-input dark:bg-input/30 h-14 rounded-2xl border bg-transparent px-4 text-[16px]"
          >
            {(["RSD", "EUR", "USD", "GBP", "CHF"] as const).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Input
            autoFocus
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={placeholder}
            className="h-14 rounded-2xl text-[17px]"
          />
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <PrimaryButton type="submit" disabled={!valid} pending={pending}>
            Continue
          </PrimaryButton>
          <button
            type="button"
            onClick={() => onSubmit(null)}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground h-12 px-3 text-[15px] font-medium transition-colors"
          >
            I&apos;d rather not say
          </button>
        </div>
      </form>
    </Screen>
  );
}

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
              className="border-primary bg-primary/12 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium"
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
function DetailsStep({
  family,
  survey,
  pending,
  onSubmit,
}: {
  family: OccupationFamily;
  survey: SurveyAnswers;
  pending: boolean;
  onSubmit: (details: Details) => void;
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

  const schedule = (
    <div>
      <p className="mb-3 text-[15px] font-medium">I can work</p>
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
    });
  }

  const content: Record<OccupationFamily, { title: string; body: ReactNode }> = {
    transport_logistics: {
      title: "Licences and routes",
      body: (
        <>
          <div>
            <p className="mb-3 text-[15px] font-medium">Driving licence categories</p>
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
    <Screen title={content[family].title} hint="Only what employers in your field usually ask for.">
      <div className="flex flex-col gap-7">{content[family].body}</div>
      <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <PrimaryButton pending={pending} onClick={submit}>
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}

type LanguageAnswer = NonNullable<SurveyAnswers["languages"]>[number];

const LANGUAGE_SUGGESTIONS = ["Serbian", "English", "German", "Russian", "Hungarian", "French", "Italian"];
const LANGUAGE_LEVEL_LABELS: Record<(typeof LANGUAGE_LEVELS)[number], string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native",
};

function LanguagesStep({
  initial,
  pending,
  onSubmit,
}: {
  initial: LanguageAnswer[];
  pending: boolean;
  onSubmit: (languages: LanguageAnswer[]) => void;
}) {
  const [rows, setRows] = useState<LanguageAnswer[]>(initial);
  const [custom, setCustom] = useState("");
  const has = (name: string) => rows.some((r) => r.language.toLowerCase() === name.toLowerCase());

  function add(language: string) {
    if (!language.trim() || has(language)) return;
    const row: LanguageAnswer = { language: language.trim(), level: "conversational" };
    setRows((prev) => [...prev, row].slice(0, 8));
  }

  return (
    <Screen title="Which languages do you speak?" hint="Add each one and pick how well you speak it.">
      <div className="flex flex-wrap gap-2">
        {LANGUAGE_SUGGESTIONS.filter((l) => !has(l)).map((language) => (
          <Chip key={language} label={`+ ${language}`} selected={false} onClick={() => add(language)} />
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add(custom);
          setCustom("");
        }}
        className="mt-4 flex gap-2"
      >
        <Input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Another language" maxLength={40} className="h-12 rounded-xl" />
        <Button type="submit" variant="outline" size="lg" className="h-12 rounded-xl" disabled={!custom.trim()}>
          Add
        </Button>
      </form>
      {rows.length ? (
        <ul className="border-border divide-border mt-6 divide-y rounded-2xl border">
          {rows.map((row) => (
            <li key={row.language} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="text-[16px] font-medium">{row.language}</span>
              <span className="flex items-center gap-2">
                <select
                  value={row.level}
                  aria-label={`${row.language} level`}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.language === row.language ? { ...r, level: event.target.value as LanguageAnswer["level"] } : r,
                      ),
                    )
                  }
                  className="border-input dark:bg-input/30 h-10 rounded-xl border bg-transparent px-3 text-[15px]"
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
                  onClick={() => setRows((prev) => prev.filter((r) => r.language !== row.language))}
                  className="text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-full"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <PrimaryButton disabled={rows.length === 0} pending={pending} onClick={() => onSubmit(rows)}>
          Continue
        </PrimaryButton>
        <SkipButton disabled={pending} onClick={() => onSubmit([])} />
      </div>
    </Screen>
  );
}

type Priority = (typeof PRIORITIES)[number];

/** "Great product" is a tech concern; commute and schedule matter on-site. */
function prioritiesFor(family: OccupationFamily | undefined): Priority[] {
  const remote = remoteOffered(family);
  return PRIORITIES.filter((p) => {
    if (p === "product") return family === "tech_digital";
    if (p === "close_to_home" || p === "fixed_schedule") return !remote;
    return true;
  });
}

function PrioritiesStep({
  family,
  initial,
  pending,
  onSubmit,
}: {
  family: OccupationFamily | undefined;
  initial: Priority[];
  pending: boolean;
  onSubmit: (priorities: Priority[]) => void;
}) {
  const [picked, setPicked] = useState<Priority[]>(initial);
  const full = picked.length >= 3;

  function toggle(id: Priority) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : full ? prev : [...prev, id]));
  }

  return (
    <Screen title="What matters most to you?" hint="Pick up to 3. We use this to rank jobs.">
      <div className="flex flex-wrap gap-2">
        {prioritiesFor(family).map((id) => (
          <Chip
            key={id}
            label={PRIORITY_LABELS[id]}
            selected={picked.includes(id)}
            disabled={full && !picked.includes(id)}
            onClick={() => toggle(id)}
          />
        ))}
      </div>
      <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <PrimaryButton disabled={picked.length === 0} pending={pending} onClick={() => onSubmit(picked)}>
          Continue
        </PrimaryButton>
        <SkipButton disabled={pending} onClick={() => onSubmit([])} />
      </div>
    </Screen>
  );
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
        compact ? "px-5 py-6" : "px-6 py-12",
        dragging ? "border-primary bg-primary/10" : "border-border bg-card/30 hover:border-primary/50",
        doneLabel && "border-primary/60 border-solid",
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
        <Loader2 className="text-primary size-7 animate-spin" aria-hidden />
      ) : doneLabel ? (
        <FileText className="text-primary size-7" aria-hidden />
      ) : (
        <UploadCloud className="text-muted-foreground size-7" aria-hidden />
      )}
      <span className="text-[16px] font-medium text-[var(--card-foreground)]">
        {pending ? "Reading your file…" : doneLabel ?? title}
      </span>
      <span className="text-muted-foreground text-[14px]">{doneLabel ? "Click to replace" : hint}</span>
    </button>
  );
}

function CvStep({
  uploaded,
  onUploaded,
  onContinue,
}: {
  uploaded: boolean;
  onUploaded: () => void;
  onContinue: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(uploaded ? "CV uploaded" : null);
  const { upload, pending, error } = useFileUpload("cv", (name) => {
    setFileName(name);
    onUploaded();
  });

  return (
    <Screen title="Upload your CV" hint="PDF works best. We read it to understand your experience and score it for you.">
      <DropZone
        title="Drop your CV here"
        hint="or click to choose a PDF"
        doneLabel={fileName}
        pending={pending}
        onFile={upload}
      />
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-[14px]">
          {error}
        </p>
      ) : null}
      <div className="mt-8">
        <PrimaryButton disabled={!fileName || pending} onClick={onContinue}>
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}

function WebsiteStep({
  initialWebsite,
  onDone,
}: {
  initialWebsite: string;
  onDone: (websiteUrl: string) => void;
}) {
  const [website, setWebsite] = useState(initialWebsite);
  const [error, setError] = useState<string | null>(null);
  const [readPages, setReadPages] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    const url = website.trim();
    if (!url) return;
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    setError(null);
    startTransition(async () => {
      const result = await ingestPortfolioUrlAction(normalized);
      if (!result.ok) {
        setError("We couldn't open that site. Check the address and try again.");
        return;
      }
      setReadPages(result.data.pages);
      // Let the confirmation register before moving on.
      setTimeout(() => onDone(normalized), 1200);
    });
  }

  return (
    <Screen
      title="Your website or portfolio"
      hint="Optional, and it tells us a lot. We read your projects and About page to understand how you work and which companies you'd fit."
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Input
          autoFocus
          value={website}
          onChange={(event) => {
            setWebsite(event.target.value);
            setReadPages(null);
          }}
          placeholder="yourname.com"
          inputMode="url"
          className="h-14 rounded-2xl text-[17px]"
        />
        {error ? (
          <p role="alert" className="text-destructive text-[14px]">
            {error}
          </p>
        ) : null}
        {readPages ? (
          <p className="text-primary flex items-center gap-2 text-[15px]">
            <Check className="size-4" aria-hidden />
            Read {readPages} {readPages === 1 ? "page" : "pages"} from your site
          </p>
        ) : null}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <PrimaryButton type="submit" disabled={!website.trim() || Boolean(readPages)} pending={pending}>
            {pending ? "Reading your site…" : "Continue"}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => onDone("")}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground h-12 px-3 text-[15px] font-medium"
          >
            I don&apos;t have one
          </button>
        </div>
      </form>
    </Screen>
  );
}

function LinkedinStep({ onDone }: { onDone: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const linkedin = useFileUpload("linkedin_text", setFileName);

  return (
    <Screen title="Add your LinkedIn" hint="Optional. On your LinkedIn profile, click More → Save to PDF, then drop the file here.">
      <DropZone
        title="Drop your LinkedIn PDF"
        hint="or click to choose it"
        doneLabel={fileName}
        pending={linkedin.pending}
        onFile={linkedin.upload}
      />
      {linkedin.error ? (
        <p role="alert" className="text-destructive mt-3 text-[14px]">
          {linkedin.error}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <PrimaryButton disabled={linkedin.pending} onClick={onDone}>
          {fileName ? "Analyze" : "Skip and analyze"}
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
  const ANALYZE_LINES = [
    "Reading your CV",
    ...(hasWebsite ? ["Going through your website"] : []),
    "Building your profile",
    "Scoring your CV",
  ];
  const lastLine = ANALYZE_LINES.length - 1;
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    const timer = setInterval(() => setLine((l) => Math.min(l + 1, lastLine)), 4000);
    return () => clearInterval(timer);
  }, [attempt, lastLine]);

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
              setLine(0);
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
    <Screen title="Reading your material…" hint="This takes about half a minute.">
      <ul className="flex flex-col gap-4">
        {ANALYZE_LINES.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 text-[16px] transition-opacity duration-500",
              i > line ? "opacity-35" : "opacity-100",
            )}
          >
            {i < line ? (
              <Check className="text-primary size-5" aria-hidden />
            ) : i === line ? (
              <Loader2 className="text-primary size-5 animate-spin" aria-hidden />
            ) : (
              <span className="border-border size-5 rounded-full border-2" aria-hidden />
            )}
            {label}
          </li>
        ))}
      </ul>
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
  const rows: Array<[string, string | null]> = [
    ["Role", roleWithLevel(summary.level, summary.role) || null],
    ["Experience", summary.years ? `${summary.years} years` : null],
    ["Strongest skills", summary.skills.length ? summary.skills.join(", ") : null],
    ["Licences", summary.licenses.length ? summary.licenses.join(", ") : null],
    ["Where", summary.where],
    ["Minimum pay", summary.pay],
  ];

  return (
    <Screen title="Here's what we understood" hint="We'll search for roles based on this. You can change it anytime on your Profile.">
      <dl className="border-border divide-border divide-y rounded-2xl border">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:gap-6">
              <dt className="text-muted-foreground w-40 shrink-0 text-[14px]">{label}</dt>
              <dd className="text-[15px] text-[var(--card-foreground)]">{value}</dd>
            </div>
          ))}
      </dl>
      {error ? (
        <p role="alert" className="text-destructive mt-4 text-[14px]">
          {error}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <PrimaryButton pending={pending} onClick={onConfirm}>
          {pending ? "Setting up your search…" : "Looks right"}
        </PrimaryButton>
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground h-12 px-3 text-[15px] font-medium"
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
      <p className="text-primary mb-3 text-center text-[13px] font-medium tracking-[0.14em] uppercase">
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
