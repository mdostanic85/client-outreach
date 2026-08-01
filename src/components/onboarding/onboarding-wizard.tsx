"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
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

  // Advance when server gates unlock after extract/approve + refresh.
  useEffect(() => {
    const current = STEP_ORDER.indexOf(step);
    const target = STEP_ORDER.indexOf(initialStep);
    if (target > current) setStep(initialStep);
  }, [initialStep, step]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const canContinue = useMemo(() => {
    if (step === "welcome") return true;
    if (step === "profile") return hasApprovedProfile;
    if (step === "search") return hasApprovedSearch;
    if (step === "done") return hasApprovedProfile && hasApprovedSearch;
    return false;
  }, [step, hasApprovedProfile, hasApprovedSearch]);

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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-5 sm:px-8 sm:py-7 lg:max-w-4xl">
      <nav
        aria-label="Setup progress"
        className="mb-6 flex items-center justify-center gap-1.5 sm:mb-8"
      >
        {STEPS.map((s, i) => {
          const done = i < stepIndex || (s.id === "done" && step === "done");
          const active = s.id === step;
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span
                  aria-hidden
                  className="bg-border hidden h-px w-4 sm:block"
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                  active && "bg-primary text-primary-foreground",
                  done && !active && "bg-muted text-foreground",
                  !done && !active && "text-muted-foreground bg-transparent",
                )}
              >
                {done && !active ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <span className="tabular-nums opacity-70">{i + 1}</span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            </div>
          );
        })}
      </nav>

      {step === "welcome" ? (
        <WelcomeStep name={userName} onContinue={goNext} />
      ) : null}

      {step === "profile" ? (
        <StepFrame
          title="Build your profile"
          description="Add a CV, LinkedIn, portfolio, or notes. Review the draft, then approve what matching can use."
          error={error}
          onBack={goBack}
          onContinue={goNext}
          continueDisabled={!canContinue}
          continueLabel={
            hasApprovedProfile
              ? "Continue to search"
              : "Approve profile to continue"
          }
          compact
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
          continueLabel={
            hasApprovedSearch
              ? "Continue"
              : "Approve search criteria to continue"
          }
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
        <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center text-center">
          <p className="text-primary mb-3 text-[13px] font-medium tracking-[0.12em] uppercase">
            Ready
          </p>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-[var(--card-foreground)]">
            You&apos;re set up
          </h1>
          <p className="text-muted-foreground mt-4 text-[16px] leading-relaxed">
            Your profile and search criteria are approved. Open Today to find
            jobs — each one comes with why it fits.
          </p>
          {error ? (
            <p className="text-destructive mt-4 text-sm">{error}</p>
          ) : null}
          <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" disabled={pending} onClick={finish}>
              {pending ? "Opening Today…" : "Go to Today"}
            </Button>
            <Button size="lg" variant="outline" onClick={goBack}>
              Back
            </Button>
          </div>
        </div>
      ) : null}
    </div>
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
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center text-center">
      <p className="text-primary mb-2 text-[12px] font-medium tracking-[0.12em] uppercase">
        First setup · ~5 min
      </p>
      <h1 className="font-display text-[clamp(1.7rem,4vw,2.4rem)] leading-[1.1] font-semibold tracking-tight text-[var(--card-foreground)]">
        {greeting}. Tell Optra about your work.
      </h1>
      <p className="text-muted-foreground mt-3 text-[14px] leading-relaxed">
        Approve a profile, then what to search for. Nothing applies for you.
      </p>
      <ol className="border-border bg-card/40 mt-7 w-full space-y-0 overflow-hidden rounded-2xl border text-left">
        {[
          {
            n: "1",
            title: "Profile",
            body: "CV, LinkedIn, site, or notes → review → approve",
          },
          {
            n: "2",
            title: "Search",
            body: "Titles and places → approve",
          },
          {
            n: "3",
            title: "Today",
            body: "A short list with why each job fits",
          },
        ].map((item) => (
          <li
            key={item.n}
            className="border-border flex gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <span className="text-primary mt-0.5 text-[12px] font-semibold">
              {item.n}
            </span>
            <div>
              <p className="font-display text-[14px] font-semibold text-[var(--card-foreground)]">
                {item.title}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-7 w-full sm:w-auto" size="lg" onClick={onContinue}>
        Start with profile
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
  compact = false,
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
  compact?: boolean;
  /** Hide primary continue until the gate is open (reduces competing CTAs). */
  hideContinueUntilReady?: boolean;
}) {
  const showContinue = !hideContinueUntilReady || !continueDisabled;
  return (
    <div className="flex flex-1 flex-col">
      <header className={cn("max-w-xl", compact ? "mb-4" : "mb-8")}>
        <h1
          className={cn(
            "font-display leading-tight font-semibold tracking-tight text-[var(--card-foreground)]",
            compact ? "text-[22px]" : "text-[28px]",
          )}
        >
          {title}
        </h1>
        <p
          className={cn(
            "text-muted-foreground leading-relaxed",
            compact ? "mt-1 text-[13px]" : "mt-2 text-[15px]",
          )}
        >
          {description}
        </p>
      </header>
      <div className="flex-1">{children}</div>
      {error ? (
        <p className="text-destructive mt-4 text-sm">{error}</p>
      ) : null}
      <div
        className={cn(
          "border-border bg-background/80 sticky bottom-0 flex flex-wrap items-center gap-3 border-t backdrop-blur-sm",
          compact ? "mt-5 py-3" : "mt-10 py-4",
        )}
      >
        <Button variant="outline" size={compact ? "sm" : "default"} onClick={onBack}>
          Back
        </Button>
        {showContinue ? (
          <Button
            size={compact ? "sm" : "default"}
            disabled={continueDisabled}
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        ) : (
          <p className="text-muted-foreground text-[12px]">
            Approve above when the draft looks right.
          </p>
        )}
      </div>
    </div>
  );
}
