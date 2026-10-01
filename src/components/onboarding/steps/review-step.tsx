"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CvScore } from "@/components/onboarding/cv-score";
import { reviewCvAction } from "@/modules/onboarding/actions";
import type { CvReview } from "@/modules/profile/cv-review";
import { PrimaryButton } from "@/components/onboarding/ui";

export function ReviewStep({
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
      <p className="text-brand-ink mb-3 text-center text-body-sm font-medium">
        Your CV score
      </p>
      {review ? (
        <CvScore review={review} />
      ) : (
        <div className="bg-card rounded-card px-5 py-6 text-center shadow-card">
          <p className="text-body">We couldn&apos;t score your CV this time.</p>
          {retryError ? <p className="text-destructive mt-2 text-body-sm">{retryError}</p> : null}
          <Button
            variant="outline"
            className="mt-4"
            disabled={retrying}
            onClick={() =>
              startRetry(async () => {
                const result = await reviewCvAction();
                if (result.ok) onReviewed(result.data);
                else setRetryError(result.error);
              })
            }
          >
            {retrying ? "Scoring…" : "Try again"}
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-destructive mt-4 text-center text-body-sm">
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
