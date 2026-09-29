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
  if (score >= 85) return { label: "Interview-ready", color: "var(--primary)" };
  if (score >= 70) return { label: "Solid, a few fixes", color: "var(--primary)" };
  if (score >= 50) return { label: "Needs work", color: "#e0a53a" };
  return { label: "Needs a rewrite", color: "#e26a5b" };
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const tone = scoreTone(score);
  return (
    <div className="relative grid size-36 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" className="stroke-border" />
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
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="text-center">
        <p className="font-display text-[2.6rem] leading-none font-semibold tabular-nums text-[var(--card-foreground)]">
          {score}
        </p>
        <p className="text-muted-foreground mt-1 text-[12px]">out of 100</p>
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
          <p className="text-[13px] font-medium tracking-[0.12em] uppercase" style={{ color: tone.color }}>
            {tone.label}
          </p>
          <p className="max-w-md text-[17px] leading-relaxed text-[var(--card-foreground)]">
            {review.headline}
          </p>
        </div>
      )}

      <section>
        <h2 className="text-muted-foreground mb-3 text-[13px] font-medium tracking-[0.12em] uppercase">
          Fix first
        </h2>
        <ol className="flex flex-col gap-3">
          {review.fixes.map((fix, i) => (
            <li key={fix.title} className="border-border bg-card/50 flex gap-3 rounded-2xl border px-4 py-3.5">
              <span className="bg-primary/12 text-primary grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums">
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-medium text-[var(--card-foreground)]">{fix.title}</p>
                <p className="text-muted-foreground mt-1 text-[14px] leading-relaxed">{fix.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-muted-foreground mb-3 text-[13px] font-medium tracking-[0.12em] uppercase">
          Already working
        </h2>
        <ul className="flex flex-col gap-2.5">
          {review.strengths.map((strength) => (
            <li key={strength} className="flex gap-2.5 text-[15px] leading-relaxed">
              <Check className="text-primary mt-1 size-4 shrink-0" aria-hidden />
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
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[14px] font-medium"
        >
          Score breakdown
          <ChevronDown
            className={cn("size-4 transition-transform", showBreakdown && "rotate-180")}
            aria-hidden
          />
        </button>
        {showBreakdown ? (
          <dl className="mt-4 flex flex-col gap-3">
            {DIMENSIONS.map((d) => {
              const value = review.dimensions[d.id];
              return (
                <div key={d.id} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3">
                  <dt className="text-[14px]">{d.label}</dt>
                  <div className="bg-border h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${value}%`, background: scoreTone(value).color }}
                    />
                  </div>
                  <dd className="text-muted-foreground text-right text-[14px] tabular-nums">{value}</dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
