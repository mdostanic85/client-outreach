"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Search, UserRound, Sparkles } from "lucide-react";
import { completeOnboardingAction } from "@/modules/onboarding/actions";
import type { OnboardingStepId } from "@/modules/onboarding/state";
import { ProfileWorkspace } from "@/components/profile-workspace";
import { SearchCriteriaWorkspace } from "@/components/search-criteria-workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StructuredProfile } from "@/modules/profile/schemas";
import type { JobSearchParams } from "@/modules/search-profile/schemas";

const STEPS: Array<{ id: OnboardingStepId; label: string }> = [
  { id: "welcome", label: "Welcome" },
  { id: "profile", label: "Profile" },
  { id: "search", label: "Search" },
  { id: "done", label: "Done" },
];

const STEP_ORDER: OnboardingStepId[] = ["welcome", "profile", "search", "done"];

type SourceView = {
  id: string;
  type: string;
  label: string | null;
  sourceUrl: string | null;
  ingestedAt: string;
  textLength: number;
};

type ProfileView = {
  id: string;
  version: number;
  status: string;
  modelId: string | null;
  promptVersion: string | null;
  createdAt: string;
  approvedAt: string | null;
  profile: StructuredProfile;
  sourceIds: string[];
};

type SearchView = {
  id: string;
  version: number;
  params: JobSearchParams;
  rationale?: string[];
  approvedAt?: string | null;
};

export function OnboardingWizard({
  initialStep,
  hasApprovedProfile,
  hasApprovedSearch,
  userName,
  sources,
  draftProfile,
  approvedProfile,
  draftSearch,
  approvedSearch,
}: {
  initialStep: OnboardingStepId;
  /** Kept for callers; sources list is authoritative in the profile step. */
  hasSources?: boolean;
  hasApprovedProfile: boolean;
  hasApprovedSearch: boolean;
  userName: string | null;
  sources: SourceView[];
  draftProfile: ProfileView | null;
  approvedProfile: ProfileView | null;
  draftSearch: SearchView | null;
  approvedSearch: SearchView | null;
}) {
  const [step, setStep] = useState<OnboardingStepId>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Advance only when server progress unlocks a later step (e.g. after approve + refresh).
  // Do not depend on `step` — that would yank the user forward when they press Back.
  useEffect(() => {
    setStep((current) => {
      const currentIdx = STEP_ORDER.indexOf(current);
      const targetIdx = STEP_ORDER.indexOf(initialStep);
      if (targetIdx > currentIdx) return initialStep;
      return current;
    });
  }, [initialStep]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isCentered = step === "welcome" || step === "done";

  const canContinue = useMemo(() => {
    if (step === "welcome") return true;
    if (step === "profile") return hasApprovedProfile;
    // Don't offer Continue while an editable draft still needs approve.
    if (step === "search") return hasApprovedSearch && !draftSearch;
    if (step === "done") return hasApprovedProfile && hasApprovedSearch;
    return false;
  }, [step, hasApprovedProfile, hasApprovedSearch, draftSearch]);

  function goNext() {
    setError(null);
    if (step === "welcome") {
      setStep("profile");
      return;
    }
    if (step === "profile") {
      if (!hasApprovedProfile) {
        setError("Approve your profile to continue.");
        return;
      }
      setStep("search");
      return;
    }
    if (step === "search") {
      if (!hasApprovedSearch) {
        setError("Generate and approve search criteria to continue.");
        return;
      }
      setStep("done");
    }
  }

  function goBack() {
    setError(null);
    if (step === "profile") setStep("welcome");
    else if (step === "search") setStep("profile");
    else if (step === "done") setStep("search");
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction();
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col px-6 pb-10 sm:px-10 lg:px-12",
        isCentered ? "max-w-5xl pt-4 sm:pt-8" : "max-w-6xl pt-2 sm:pt-4",
      )}
    >
      <ProgressStepper stepIndex={stepIndex} />

      {step === "welcome" ? (
        <WelcomeStep name={userName} onContinue={goNext} />
      ) : null}

      {step === "profile" ? (
        <StepFrame
          title="Build your profile"
          description="Add your CV, LinkedIn, portfolio, or notes. Review the draft, then approve it for matching."
          error={error}
          onBack={goBack}
          onContinue={goNext}
          continueDisabled={!canContinue}
          continueLabel={
            hasApprovedProfile
              ? "Continue to search"
              : "Approve profile to continue"
          }
          hideContinueUntilReady={!hasApprovedProfile}
        >
          <ProfileWorkspace
            variant="onboarding"
            sources={sources}
            draft={draftProfile}
            approved={approvedProfile}
          />
        </StepFrame>
      ) : null}

      {step === "search" ? (
        <StepFrame
          title="Set search criteria"
          description="Review job titles, locations, and boards. Approve before we look for roles."
          error={error}
          onBack={goBack}
          onContinue={goNext}
          continueDisabled={!canContinue}
          continueLabel="Continue"
          hideContinueUntilReady={!hasApprovedSearch || Boolean(draftSearch)}
        >
          <SearchCriteriaWorkspace
            embedded
            draft={
              draftSearch
                ? {
                    id: draftSearch.id,
                    version: draftSearch.version,
                    params: draftSearch.params,
                    rationale: draftSearch.rationale ?? [],
                  }
                : null
            }
            approved={
              approvedSearch
                ? {
                    id: approvedSearch.id,
                    version: approvedSearch.version,
                    params: approvedSearch.params,
                    approvedAt: approvedSearch.approvedAt ?? null,
                  }
                : null
            }
          />
        </StepFrame>
      ) : null}

      {step === "done" ? (
        <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center py-10 text-center sm:py-16">
          <div className="bg-primary/12 text-primary mb-8 grid size-16 place-items-center rounded-2xl sm:size-20">
            <Sparkles className="size-7 sm:size-8" aria-hidden />
          </div>
          <p className="text-primary mb-3 text-[13px] font-medium tracking-[0.14em] uppercase">
            Ready
          </p>
          <h1 className="font-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[1.05] font-semibold tracking-tight text-[var(--card-foreground)]">
            You&apos;re ready
          </h1>
          <p className="text-muted-foreground mt-5 max-w-lg text-[17px] leading-relaxed sm:text-[18px]">
            Your profile and search criteria are approved. Open Today to review
            roles, each with why it fits.
          </p>
          {error ? (
            <p className="text-destructive mt-5 text-[15px]">{error}</p>
          ) : null}
          <div className="mt-12 flex w-full flex-col items-center gap-4">
            <Button
              size="lg"
              className="h-12 min-w-[12rem] px-6 text-[15px]"
              disabled={pending}
              onClick={finish}
            >
              {pending ? "Opening Today…" : "Go to Today"}
              {!pending ? (
                <ArrowRight className="size-4" aria-hidden />
              ) : null}
            </Button>
            <button
              type="button"
              onClick={goBack}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[14px] font-medium"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to search
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgressStepper({ stepIndex }: { stepIndex: number }) {
  return (
    <nav
      aria-label="Setup progress"
      className="mb-10 flex w-full items-start justify-center sm:mb-14"
    >
      <ol className="flex w-full max-w-2xl items-start">
        {STEPS.map((s, i) => {
          const done = i < stepIndex || (s.id === "done" && stepIndex === 3);
          const active = i === stepIndex;
          return (
            <li
              key={s.id}
              className={cn(
                "flex flex-1 flex-col items-center",
                i < STEPS.length - 1 && "relative",
              )}
            >
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-4 left-[calc(50%+1.1rem)] h-0.5 w-[calc(100%-2.2rem)] sm:top-5",
                    i < stepIndex ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid size-8 place-items-center rounded-full text-[13px] font-semibold transition-colors sm:size-10 sm:text-[15px]",
                  active &&
                    "bg-primary text-primary-foreground ring-primary/25 ring-4",
                  done && !active && "bg-primary text-primary-foreground",
                  !done &&
                    !active &&
                    "border-border bg-background text-muted-foreground border-2",
                )}
              >
                {done && !active ? (
                  <Check className="size-3.5 sm:size-4" aria-hidden />
                ) : (
                  <span className="tabular-nums">{i + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  "mt-2.5 text-center text-[12px] font-medium sm:mt-3 sm:text-[14px]",
                  active
                    ? "text-foreground"
                    : done
                      ? "text-foreground/80"
                      : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function WelcomeStep({
  name,
  onContinue,
}: {
  name: string | null;
  onContinue: () => void;
}) {
  const greeting = name?.trim()
    ? `Hi, ${name.trim().split(" ")[0]}`
    : "Welcome";

  const roadmap = [
    {
      n: "01",
      icon: UserRound,
      title: "Profile",
      body: "Add your CV, LinkedIn, site, or notes. Review the draft and approve it.",
    },
    {
      n: "02",
      icon: Search,
      title: "Search",
      body: "Confirm titles, locations, and boards before we look for roles.",
    },
    {
      n: "03",
      icon: Sparkles,
      title: "Today",
      body: "Review a short list of roles, each with why it fits.",
    },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-4 text-center sm:py-8">
      <p className="text-primary mb-4 text-[13px] font-medium tracking-[0.14em] uppercase">
        Setup · about 5 minutes
      </p>
      <h1 className="font-display max-w-3xl text-[clamp(2.1rem,5.5vw,3.4rem)] leading-[1.08] font-semibold tracking-tight text-[var(--card-foreground)]">
        {greeting}. Build a profile Optra can trust.
      </h1>
      <p className="text-muted-foreground mt-5 max-w-xl text-[16px] leading-relaxed sm:text-[18px]">
        Approve who you are, then what to search for. Nothing applies without
        you.
      </p>

      <ul className="mt-12 grid w-full gap-4 text-left sm:mt-14 sm:grid-cols-3 sm:gap-5">
        {roadmap.map((item) => (
          <li
            key={item.n}
            className="border-border bg-card/50 flex flex-col rounded-2xl border px-5 py-6 sm:min-h-[11.5rem] sm:px-6 sm:py-7"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="bg-primary/12 text-primary grid size-11 place-items-center rounded-xl">
                <item.icon className="size-5" aria-hidden />
              </span>
              <span className="text-muted-foreground font-display text-[13px] font-semibold tracking-[0.08em] tabular-nums">
                {item.n}
              </span>
            </div>
            <p className="font-display text-[18px] font-semibold tracking-tight text-[var(--card-foreground)] sm:text-[19px]">
              {item.title}
            </p>
            <p className="text-muted-foreground mt-2 text-[14px] leading-relaxed sm:text-[15px]">
              {item.body}
            </p>
          </li>
        ))}
      </ul>

      <Button
        className="mt-12 h-12 min-w-[14rem] px-8 text-[15px] sm:mt-14"
        size="lg"
        onClick={onContinue}
      >
        Start setup
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function StepFrame({
  title,
  description,
  children,
  error,
  onBack,
  onContinue,
  continueDisabled,
  continueLabel,
  hideContinueUntilReady = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
  continueLabel: string;
  /** Hide primary continue until the gate is open (reduces competing CTAs). */
  hideContinueUntilReady?: boolean;
}) {
  const showContinue = !hideContinueUntilReady || !continueDisabled;
  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-8 max-w-2xl sm:mb-10">
        <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.35rem)] leading-tight font-semibold tracking-tight text-[var(--card-foreground)]">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed sm:text-[16px]">
          {description}
        </p>
      </header>
      <div className="flex-1">{children}</div>
      {error ? (
        <p className="text-destructive mt-6 text-[15px]">{error}</p>
      ) : null}
      <div
        className={cn(
          "border-border bg-background/85 sticky bottom-0 mt-10 flex flex-wrap items-center gap-3 border-t py-5 backdrop-blur-sm",
          showContinue ? "justify-between" : "justify-start",
        )}
      >
        <Button
          variant="ghost"
          size="lg"
          className="text-muted-foreground h-11 px-3 text-[15px]"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        {showContinue ? (
          <Button
            size="lg"
            className="h-11 px-5 text-[15px]"
            disabled={continueDisabled}
            onClick={onContinue}
          >
            {continueLabel}
            {!continueDisabled ? (
              <ArrowRight className="size-4" aria-hidden />
            ) : null}
          </Button>
        ) : (
          <p className="text-muted-foreground text-[14px]">
            Approve above when the draft looks right.
          </p>
        )}
      </div>
    </div>
  );
}
