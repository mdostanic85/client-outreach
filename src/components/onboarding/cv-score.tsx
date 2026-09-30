"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CvReview } from "@/modules/profile/cv-review";

const DIMENSIONS: Array<{ id: keyof CvReview["dimensions"]; label: string }> = [
  { id: "clarity", label: "Clarity" },
  { id: "impact", label: "Impact" },
  { id: "relevance", label: "Fit for the role" },
  { id: "evidence", label: "Proof of work" },
  { id: "polish", label: "Polish" },
];

export function scoreTone(score: number) {
  if (score >= 85) return { label: "Interview-ready", color: "var(--brand)" };
  if (score >= 70) return { label: "Solid, a few fixes", color: "var(--brand)" };
  if (score >= 50) return { label: "Needs work", color: "var(--warn)" };
  return { label: "Needs a rewrite", color: "var(--destructive)" };
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const tone = scoreTone(score);
  return (
    <div className="relative grid size-36 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" className="stroke-subtle" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          stroke={tone.color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-1000 ease-enter motion-reduce:transition-none"
        />
      </svg>
      <div className="text-center">
        <p className="text-h2 leading-none tabular-nums text-foreground">
          {score}
        </p>
        <p className="text-muted-foreground mt-1 text-caption">out of 100</p>
      </div>
    </div>
  );
}

/**
 * Score, verdict, 3 strengths, 3 fixes. The per-dimension breakdown stays folded.
 * `detailsOnly` skips the score hero when the parent already shows it.
 */
export function CvScore({
  review,
  detailsOnly = false,
}: {
  review: CvReview;
  detailsOnly?: boolean;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const tone = scoreTone(review.overall);

  return (
    <div className={cn("flex flex-col", detailsOnly ? "gap-6" : "gap-8")}>
      {detailsOnly ? null : (
        <div className="flex flex-col items-center gap-4 text-center">
          <ScoreRing score={review.overall} />
          <p className="text-body-sm font-medium" style={{ color: tone.color }}>
            {tone.label}
          </p>
          <p className="max-w-md text-body-lg leading-relaxed text-foreground">
            {review.headline}
          </p>
        </div>
      )}

      <section>
        <h2 className="text-muted-foreground mb-3 text-body-sm font-medium">
          Fix first
        </h2>
        <ol className="flex flex-col gap-3">
          {review.fixes.map((fix, i) => (
            <li key={fix.title} className="bg-card flex gap-3 rounded-panel px-4 py-4">
              <span className="bg-brand-wash text-brand-ink grid size-7 shrink-0 place-items-center rounded-full text-body-sm font-medium tabular-nums">
                {i + 1}
              </span>
              <div>
                <p className="text-body text-foreground">{fix.title}</p>
                <p className="text-muted-foreground mt-1 text-body-sm leading-relaxed">{fix.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-muted-foreground mb-3 text-body-sm font-medium">
          Already working
        </h2>
        <ul className="flex flex-col gap-2.5">
          {review.strengths.map((strength) => (
            <li key={strength} className="flex gap-2.5 text-body leading-relaxed">
              <Check className="text-brand-ink mt-1 size-4 shrink-0" aria-hidden />
              <span>{strength}</span>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          aria-expanded={showBreakdown}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md text-body-sm font-medium transition-colors duration-150"
        >
          Score breakdown
          <ChevronDown
            className={cn("size-4 transition-transform duration-300 ease-standard", showBreakdown && "rotate-180")}
            aria-hidden
          />
        </button>
        {showBreakdown ? (
          <dl className="mt-4 flex flex-col gap-3">
            {DIMENSIONS.map((d) => {
              const value = review.dimensions[d.id];
              return (
                <div key={d.id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 sm:grid-cols-[8.5rem_1fr_2.5rem] sm:gap-3">
                  <dt className="text-body-sm">{d.label}</dt>
                  <div className="bg-subtle h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${value}%`, background: scoreTone(value).color }}
                    />
                  </div>
                  <dd className="text-muted-foreground text-right text-body-sm tabular-nums">{value}</dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
