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
        <p className="text-body font-medium text-foreground">
          Evidence
        </p>
        <p className="text-muted-foreground text-body-sm leading-relaxed">
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

      <section className="bg-subtle space-y-3 rounded-panel p-4">
        <h3 className="text-body-sm font-medium text-foreground">
          Role analysis
        </h3>
        {analysis.roleSummary ? (
          <p className="text-muted-foreground text-body-sm leading-relaxed">
            {analysis.roleSummary}
          </p>
        ) : (
          <p className="text-muted-foreground text-body-sm">
            No analysis summary.
          </p>
        )}
        {analysis.fitStrengths.length ? (
          <div>
            <p className="text-body-sm font-medium text-foreground">
              Fit strengths
            </p>
            <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 pl-5 text-body-sm">
              {analysis.fitStrengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.gaps.length ? (
          <div>
            <p className="text-body-sm font-medium text-foreground">
              Gaps
            </p>
            <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 pl-5 text-body-sm">
              {analysis.gaps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.mustHaves.length ? (
          <div>
            <p className="text-body-sm font-medium text-foreground">
              Must-haves
            </p>
            <p className="text-muted-foreground mt-1 text-body-sm">
              {analysis.mustHaves.join(" · ")}
            </p>
          </div>
        ) : null}
      </section>

      <section className="bg-subtle space-y-3 rounded-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-body-sm font-medium text-foreground">
            Grounding
          </h3>
          <span
            className={
              grounding.ok
                ? "text-body-sm font-medium text-success"
                : "text-body-sm font-medium text-warn"
            }
          >
            {grounding.ok ? "Passed" : "Needs review"}
          </span>
        </div>
        {grounding.usedFields.length ? (
          <div>
            <p className="text-body-sm font-medium text-foreground">
              Profile fields used
            </p>
            <p className="text-muted-foreground mt-1 text-body-sm">
              {grounding.usedFields.join(", ")}
            </p>
          </div>
        ) : null}
        {grounding.usedProjectIds.length ? (
          <div>
            <p className="text-body-sm font-medium text-foreground">
              Projects used
            </p>
            <p className="text-muted-foreground mt-1 text-body-sm">
              {grounding.usedProjectIds.join(", ")}
            </p>
          </div>
        ) : null}
        {grounding.usedCompanyFacts.length ? (
          <div>
            <p className="text-body-sm font-medium text-foreground">
              Company / role facts
            </p>
            <p className="text-muted-foreground mt-1 text-body-sm">
              {grounding.usedCompanyFacts.join(", ")}
            </p>
          </div>
        ) : null}
        {grounding.rejectedClaims.length ? (
          <div>
            <p className="text-body-sm font-medium text-destructive">
              Rejected claims
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-body-sm text-destructive">
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
