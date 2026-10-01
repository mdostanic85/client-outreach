"use client";

import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { MaterialReader } from "@/components/onboarding/material-reader";
import { analyzeProfileAction } from "@/modules/onboarding/actions";
import type { ProfileSummary } from "@/modules/onboarding/survey-core";
import type { CvReview } from "@/modules/profile/cv-review";
import { PrimaryButton, Screen } from "@/components/onboarding/ui";

export function AnalyzingStep({
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
      else onDone(result.data);
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
          <button type="button" onClick={onBack} className={buttonVariants({ variant: "ghost", size: "lg" })}>
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
