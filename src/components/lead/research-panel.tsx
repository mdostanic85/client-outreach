import { PanelBody, PanelHeader, SectionTitle, Surface } from "@/components/page-shell";
import { Separator } from "@/components/ui/separator";
import type { LeadDetail } from "./lead-stage";

/** The company research brief: need signals, fit, risks and cited evidence. */
export function ResearchPanel({
  brief,
  compact = false,
}: {
  brief: LeadDetail["brief"];
  compact?: boolean;
}) {
  return (
    <Surface className={compact ? "lg:sticky lg:top-4" : undefined}>
      <PanelHeader>
        <SectionTitle
          title={compact ? "Company snapshot" : "Research"}
          description="Need-now evidence, fit, and uncertainty."
        />
      </PanelHeader>
      <PanelBody className="text-body-sm">
        {!brief ? (
          <p className="text-muted-foreground">No research yet.</p>
        ) : (
          <>
            <p className={compact ? "line-clamp-4" : undefined}>
              {brief.result.companySummary}
            </p>
            {!compact ? <Separator /> : null}
            <div>
              <p className="mb-1 font-medium">Need signals</p>
              <ul className="list-disc space-y-2 pl-5">
                {brief.result.currentNeedSignals
                  .slice(0, compact ? 2 : undefined)
                  .map((n) => (
                    <li key={n.claim}>
                      {n.claim}{" "}
                      <span className="text-muted-foreground">
                        · {n.strength}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium">Fit</p>
              <ul className="list-disc space-y-2 pl-5">
                {brief.result.fitReasons
                  .slice(0, compact ? 2 : undefined)
                  .map((f) => (
                    <li key={f.reason}>{f.reason}</li>
                  ))}
              </ul>
            </div>
            {!compact ? (
              <>
                <div>
                  <p className="mb-1 font-medium">Risks / unknowns</p>
                  <ul className="list-disc space-y-2 pl-5">
                    {brief.result.risksAndUnknowns.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-medium">Evidence</p>
                  <ul className="space-y-2">
                    {brief.evidence.map((e) => (
                      <li key={e.id} className="rounded-tile bg-subtle p-3">
                        <p className="font-medium">
                          {e.id}:{" "}
                          <a
                            href={e.url}
                            className="underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {e.pageTitle ?? e.url}
                          </a>
                        </p>
                        <p className="text-muted-foreground line-clamp-3 text-body-sm">
                          {e.excerpt}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div>
                <p className="mb-1 font-medium">Uncertainty</p>
                <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-body-sm">
                  {brief.result.risksAndUnknowns.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </PanelBody>
    </Surface>
  );
}
