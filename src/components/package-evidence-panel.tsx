import { InlineAlert } from "@/components/inline-alert";
import type {
  GroundingReport,
  PackageAnalysis,
  PackageWarning,
} from "@/modules/applications/schemas";

export function PackageEvidencePanel({
  analysis,
  grounding,
  warnings,
}: {
  analysis: PackageAnalysis;
  grounding: GroundingReport;
  warnings: PackageWarning[];
}) {
  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="font-display text-[16px] font-semibold tracking-tight text-[var(--card-foreground)]">
          Evidence
        </p>
        <p className="text-muted-foreground text-[14px] leading-relaxed">
          Why this package was shaped this way — strengths, gaps, and grounding
          checks.
        </p>
      </div>

      {warnings.length ? (
        <div className="space-y-2">
          {warnings.map((w) => (
            <InlineAlert
              key={w.code}
              variant={w.severity === "block" ? "error" : "info"}
            >
              {w.message}
            </InlineAlert>
          ))}
        </div>
      ) : null}

      <section className="border-border space-y-3 rounded-2xl border p-4">
        <h3 className="text-[14px] font-semibold text-[var(--card-foreground)]">
          Role analysis
        </h3>
        {analysis.roleSummary ? (
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            {analysis.roleSummary}
          </p>
        ) : (
          <p className="text-muted-foreground text-[14px]">
            No analysis summary.
          </p>
        )}
        {analysis.fitStrengths.length ? (
          <div>
            <p className="text-[13px] font-medium text-[var(--card-foreground)]">
              Fit strengths
            </p>
            <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 pl-5 text-[14px]">
              {analysis.fitStrengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.gaps.length ? (
          <div>
            <p className="text-[13px] font-medium text-[var(--card-foreground)]">
              Gaps
            </p>
            <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 pl-5 text-[14px]">
              {analysis.gaps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.mustHaves.length ? (
          <div>
            <p className="text-[13px] font-medium text-[var(--card-foreground)]">
              Must-haves
            </p>
            <p className="text-muted-foreground mt-1 text-[14px]">
              {analysis.mustHaves.join(" · ")}
            </p>
          </div>
        ) : null}
      </section>

      <section className="border-border space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-[var(--card-foreground)]">
            Grounding
          </h3>
          <span
            className={
              grounding.ok
                ? "text-[13px] font-medium text-emerald-600 dark:text-emerald-400"
                : "text-[13px] font-medium text-amber-700 dark:text-amber-300"
            }
          >
            {grounding.ok ? "Passed" : "Needs review"}
          </span>
        </div>
        {grounding.usedFields.length ? (
          <div>
            <p className="text-[13px] font-medium text-[var(--card-foreground)]">
              Profile fields used
            </p>
            <p className="text-muted-foreground mt-1 text-[14px]">
              {grounding.usedFields.join(", ")}
            </p>
          </div>
        ) : null}
        {grounding.usedProjectIds.length ? (
          <div>
            <p className="text-[13px] font-medium text-[var(--card-foreground)]">
              Projects used
            </p>
            <p className="text-muted-foreground mt-1 text-[14px]">
              {grounding.usedProjectIds.join(", ")}
            </p>
          </div>
        ) : null}
        {grounding.usedCompanyFacts.length ? (
          <div>
            <p className="text-[13px] font-medium text-[var(--card-foreground)]">
              Company / role facts
            </p>
            <p className="text-muted-foreground mt-1 text-[14px]">
              {grounding.usedCompanyFacts.join(", ")}
            </p>
          </div>
        ) : null}
        {grounding.rejectedClaims.length ? (
          <div>
            <p className="text-[13px] font-medium text-red-600 dark:text-red-400">
              Rejected claims
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[14px] text-red-700 dark:text-red-300">
              {grounding.rejectedClaims.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
