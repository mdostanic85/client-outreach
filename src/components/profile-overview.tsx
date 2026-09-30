"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { CvScore, scoreTone } from "@/components/onboarding/cv-score";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reviewCvAction } from "@/modules/onboarding/actions";
import type { CvReview } from "@/modules/profile/cv-review";

/** CV score only. Search targets live on Search criteria and in the profile itself. */
export function ProfileOverview({
  review: initialReview,
  hasCv,
}: {
  review: CvReview | null;
  hasCv: boolean;
}) {
  const [review, setReview] = useState(initialReview);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function rescore() {
    setError(null);
    startTransition(async () => {
      const result = await reviewCvAction();
      if (result.ok) {
        setReview(result.review);
        setOpen(true);
      } else setError(result.error);
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-4">
      <section data-reveal className="bg-card rounded-card p-5 sm:p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-body-sm font-medium">
              CV score
            </p>
            {review ? (
              <>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="text-[2rem] leading-none font-medium tabular-nums text-foreground">
                    {review.overall}
                  </span>
                  <span className="text-body-sm font-medium" style={{ color: scoreTone(review.overall).color }}>
                    {scoreTone(review.overall).label}
                  </span>
                </p>
                <p className="text-muted-foreground mt-2 max-w-xl text-body leading-relaxed">
                  {review.headline}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground mt-2 text-body">
                {hasCv ? "Your CV hasn't been scored yet." : "Upload a CV below to get a score."}
              </p>
            )}
          </div>
          {review ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-body-sm font-medium"
            >
              {open ? "Hide" : "What to fix"}
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          ) : hasCv ? (
            <Button onClick={rescore} disabled={pending}>
              {pending ? "Scoring…" : "Score my CV"}
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-destructive mt-3 text-body-sm">{error}</p> : null}
        {review && open ? (
          <div className="border-border mt-6 border-t pt-6">
            <CvScore review={review} detailsOnly />
            <button
              type="button"
              onClick={rescore}
              disabled={pending}
              className="text-muted-foreground hover:text-foreground mt-6 text-body-sm font-medium"
            >
              {pending ? "Scoring…" : "Updated your CV? Score it again"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
