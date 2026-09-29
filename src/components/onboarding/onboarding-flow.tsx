"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, UploadCloud } from "lucide-react";
import { ingestCvAction, ingestPortfolioUrlAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CvScore } from "@/components/onboarding/cv-score";
import { cn } from "@/lib/utils";
import {
  analyzeProfileAction,
  completeOnboardingAction,
  confirmProfileAction,
  reviewCvAction,
  saveSurveyStepAction,
} from "@/modules/onboarding/actions";
import type { ProfileSummary, SurveyAnswers } from "@/modules/onboarding/survey";
import type { CvReview } from "@/modules/profile/cv-review";
import { roleWithLevel } from "@/modules/profile/schemas";

export type FlowStep =
  | "intro"
  | "workType"
  | "role"
  | "level"
  | "workMode"
  | "location"
  | "pay"
  | "availability"
  | "priorities"
  | "cv"
  | "website"
  | "linkedin"
  | "analyzing"
  | "summary"
  | "review";

const ORDER: FlowStep[] = [
  "intro",
  "workType",
  "role",
  "level",
  "workMode",
  "location",
  "pay",
  "availability",
  "priorities",
  "cv",
  "website",
  "linkedin",
  "analyzing",
  "summary",
  "review",
];

/** Steps that count toward the progress bar. */
const QUESTION_STEPS = ORDER.slice(1, ORDER.indexOf("linkedin") + 1);

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ROLE_SUGGESTIONS = [
  "Product Designer",
  "Software Engineer",
  "Product Manager",
  "Data Analyst",
  "Marketing Manager",
  "UX Researcher",
];

const LOCATION_OPTIONS = ["Europe", "United States", "United Kingdom", "Worldwide"];

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
  const [cvUploaded, setCvUploaded] = useState(hasCv);
  const [summary, setSummary] = useState<ProfileSummary | null>(initialSummary);
  const [review, setReview] = useState<CvReview | null>(initialReview);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(next: FlowStep) {
    setError(null);
    setDirection(ORDER.indexOf(next) >= ORDER.indexOf(step) ? 1 : -1);
    setStep(next);
  }

  function nextOf(current: FlowStep): FlowStep {
    return ORDER[ORDER.indexOf(current) + 1] ?? "review";
  }

  function back() {
    const idx = ORDER.indexOf(step);
    if (idx > 0) go(ORDER[idx - 1]!);
  }

  /** Save one answer, then move on. */
  function answer(patch: SurveyAnswers, next: FlowStep = nextOf(step)) {
    setSurvey((prev) => ({ ...prev, ...patch }));
    startTransition(async () => {
      const result = await saveSurveyStepAction(patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      go(next);
    });
  }

  const questionIndex = QUESTION_STEPS.indexOf(step);
  const progress =
    step === "intro"
      ? 0
      : questionIndex >= 0
        ? (questionIndex + 1) / QUESTION_STEPS.length
        : 1;
  const canGoBack = step !== "intro" && step !== "analyzing" && step !== "review";

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
              title={`${userName?.trim() ? `Hi, ${userName.trim().split(" ")[0]}. ` : ""}Let's find roles that fit you.`}
              hint="A few quick questions, then your CV. At the end you get an honest score for your CV and what to fix first."
            >
              <PrimaryButton onClick={() => go("workType")}>Start</PrimaryButton>
            </Screen>
          ) : null}

          {step === "workType" ? (
            <Screen title="What are you looking for?">
              <Choices
                value={survey.workType}
                disabled={pending}
                onPick={(workType) => answer({ workType })}
                options={[
                  { id: "full_time", label: "A full-time job" },
                  { id: "contract", label: "Contract or freelance work" },
                  { id: "both", label: "Open to both" },
                ]}
              />
            </Screen>
          ) : null}

          {step === "role" ? (
            <RoleStep
              initial={survey.role ?? ""}
              pending={pending}
              onSubmit={(role) => answer({ role })}
            />
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

          {step === "workMode" ? (
            <Screen title="How do you want to work?">
              <Choices
                value={survey.workMode}
                disabled={pending}
                onPick={(workMode) => answer({ workMode })}
                options={[
                  { id: "remote", label: "Remote only" },
                  { id: "hybrid", label: "Hybrid" },
                  { id: "onsite", label: "In the office" },
                  { id: "any", label: "Any of these" },
                ]}
              />
            </Screen>
          ) : null}

          {step === "location" ? (
            <LocationStep
              title={
                survey.workMode === "remote"
                  ? "Which regions can you work for?"
                  : "Where should the job be?"
              }
              initial={survey.locations ?? []}
              pending={pending}
              onSubmit={(locations) => answer({ locations })}
            />
          ) : null}

          {step === "pay" ? (
            <PayStep
              initial={survey.pay ?? null}
              workType={survey.workType}
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

          {step === "priorities" ? (
            <PrioritiesStep
              initial={survey.priorities ?? []}
              pending={pending}
              onSubmit={(priorities) => answer({ priorities })}
            />
          ) : null}

          {step === "cv" ? (
            <CvStep
              uploaded={cvUploaded}
              onUploaded={() => setCvUploaded(true)}
              onContinue={() => go("website")}
            />
          ) : null}

          {step === "website" ? (
            <WebsiteStep
              initialWebsite={survey.websiteUrl ?? ""}
              onDone={(websiteUrl) => answer({ websiteUrl }, "linkedin")}
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
              onBack={() => go("website")}
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
              onBack={() => go("website")}
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
  options: Array<{ id: T; label: string }>;
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
              "flex h-14 items-center justify-between rounded-2xl border px-5 text-left text-[16px] font-medium transition-colors disabled:opacity-60",
              selected
                ? "border-primary bg-primary/10 text-[var(--card-foreground)]"
                : "border-border bg-card/40 hover:border-primary/50 hover:bg-card/70",
            )}
          >
            {option.label}
            {selected ? <Check className="text-primary size-5" aria-hidden /> : null}
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
  onSubmit,
}: {
  initial: string;
  pending: boolean;
  onSubmit: (role: string) => void;
}) {
  const [role, setRole] = useState(initial);
  const trimmed = role.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <Screen title="What role are you going for?" hint="Your main job title. You can add more later.">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Input
          autoFocus
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="e.g. Product Designer"
          maxLength={80}
          className="h-14 rounded-2xl text-[17px]"
        />
        <div className="flex flex-wrap gap-2">
          {ROLE_SUGGESTIONS.map((suggestion) => (
            <Chip
              key={suggestion}
              label={suggestion}
              selected={trimmed === suggestion}
              onClick={() => setRole(suggestion)}
            />
          ))}
        </div>
        <div>
          <PrimaryButton type="submit" disabled={!trimmed} pending={pending}>
            Continue
          </PrimaryButton>
        </div>
      </form>
    </Screen>
  );
}

function LocationStep({
  title,
  initial,
  pending,
  onSubmit,
}: {
  title: string;
  initial: string[];
  pending: boolean;
  onSubmit: (locations: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");
  const options = [...LOCATION_OPTIONS, ...picked.filter((p) => !LOCATION_OPTIONS.includes(p))];

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

  return (
    <Screen title={title} hint="Pick any that apply, or add a country or city.">
      <div className="flex flex-wrap gap-2">
        {options.map((location) => (
          <Chip
            key={location}
            label={location}
            selected={picked.includes(location)}
            onClick={() => toggle(location)}
          />
        ))}
      </div>
      <form onSubmit={addCustom} className="mt-5 flex gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="Add a country or city"
          maxLength={60}
          className="h-12 rounded-xl"
        />
        <Button type="submit" variant="outline" size="lg" className="h-12 rounded-xl" disabled={!custom.trim()}>
          Add
        </Button>
      </form>
      <div className="mt-8">
        <PrimaryButton disabled={picked.length === 0} pending={pending} onClick={() => onSubmit(picked)}>
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}

function PayStep({
  initial,
  workType,
  pending,
  onSubmit,
}: {
  initial: SurveyAnswers["pay"];
  workType: SurveyAnswers["workType"];
  pending: boolean;
  onSubmit: (pay: SurveyAnswers["pay"]) => void;
}) {
  const [mode, setMode] = useState<"salary" | "hourly">(
    initial?.mode ?? (workType === "contract" ? "hourly" : "salary"),
  );
  const [currency, setCurrency] = useState<"EUR" | "USD" | "GBP" | "CHF" | "RSD">(
    initial?.currency ?? "EUR",
  );
  const [amount, setAmount] = useState(initial?.min ? String(initial.min) : "");
  const value = Number(amount.replace(/[^\d.]/g, ""));
  const valid = Number.isFinite(value) && value > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSubmit({ mode, currency, min: value });
  }

  return (
    <Screen title="What's the lowest pay you'd accept?" hint="Used to skip roles that pay too little. Only you see this.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex gap-2">
          <Chip label="Per year" selected={mode === "salary"} onClick={() => setMode("salary")} />
          <Chip label="Per hour" selected={mode === "hourly"} onClick={() => setMode("hourly")} />
        </div>
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as typeof currency)}
            aria-label="Currency"
            className="border-input dark:bg-input/30 h-14 rounded-2xl border bg-transparent px-4 text-[16px]"
          >
            {(["EUR", "USD", "GBP", "CHF", "RSD"] as const).map((c) => (
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
            placeholder={mode === "hourly" ? "e.g. 45" : "e.g. 60000"}
            className="h-14 rounded-2xl text-[17px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <PrimaryButton type="submit" disabled={!valid} pending={pending}>
            Continue
          </PrimaryButton>
          <SkipButton disabled={pending} onClick={() => onSubmit(null)} />
        </div>
      </form>
    </Screen>
  );
}

const PRIORITY_OPTIONS = [
  { id: "pay", label: "Compensation" },
  { id: "flexibility", label: "Flexible hours" },
  { id: "product", label: "Great product" },
  { id: "team", label: "Strong team" },
  { id: "growth", label: "Room to grow" },
  { id: "mission", label: "Meaningful mission" },
  { id: "balance", label: "Work-life balance" },
  { id: "stability", label: "Stable company" },
] as const;

type Priority = (typeof PRIORITY_OPTIONS)[number]["id"];

function PrioritiesStep({
  initial,
  pending,
  onSubmit,
}: {
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
    <Screen title="What matters most to you?" hint="Pick up to 3. We use this to rank roles.">
      <div className="flex flex-wrap gap-2">
        {PRIORITY_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={picked.includes(option.id)}
            disabled={full && !picked.includes(option.id)}
            onClick={() => toggle(option.id)}
          />
        ))}
      </div>
      <div className="mt-8 flex items-center gap-2">
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
      hint="This tells us the most about you. We read your case studies and About page to understand how you work and which companies you'd fit."
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
        <div className="flex items-center gap-2">
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
      <div className="mt-8 flex items-center gap-2">
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
    ...(hasWebsite ? ["Going through your portfolio"] : []),
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
        <div className="flex items-center gap-2">
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
      <div className="mt-8 flex items-center gap-2">
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
