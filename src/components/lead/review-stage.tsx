"use client";

import { useState } from "react";
import { PanelBody, PanelHeader, SectionTitle, Surface } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptLeadAction, rejectLeadAction, researchLeadAction, saveForLaterAction } from "@/modules/leads/actions";
import { DECISION_STATES, type StageProps } from "./lead-stage";
import { ResearchPanel } from "./research-panel";

/** Held by the workspace so a typed reason survives switching stages. */
export function useReviewForm() {
  const [rejectReason, setRejectReason] = useState("");
  return { rejectReason, setRejectReason };
}

/** Research brief plus the accept / save / reject decision. */
export function ReviewStage({
  detail,
  pending,
  run,
  form,
}: StageProps & { form: ReturnType<typeof useReviewForm> }) {
  const { rejectReason, setRejectReason } = form;
  const canDecide = DECISION_STATES.includes(detail.lead.state);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <ResearchPanel brief={detail.brief} />
      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <Surface>
          <PanelHeader>
            <SectionTitle
              title="Decide"
              description="Accept unlocks contact confirmation and compose."
            />
          </PanelHeader>
          <PanelBody>
            {detail.lead.researchStatus === "pending" ||
            detail.lead.researchStatus === "incomplete" ? (
              <Button
                className="w-full"
                disabled={pending}
                variant="secondary"
                onClick={() =>
                  run(() =>
                    researchLeadAction(detail.company.id, detail.lead.id),
                  )
                }
              >
                Run research
              </Button>
            ) : null}

            {canDecide && detail.brief ? (
              <>
                <Button
                  className="w-full"
                  disabled={pending}
                  onClick={() => run(() => acceptLeadAction(detail.lead.id))}
                >
                  Accept
                </Button>
                <Button
                  className="w-full"
                  disabled={pending}
                  variant="secondary"
                  onClick={() =>
                    run(() => saveForLaterAction(detail.lead.id))
                  }
                >
                  Save for later
                </Button>
                <div className="grid gap-2">
                  <Label htmlFor="reject">Reject reason</Label>
                  <Input
                    id="reject"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Wrong segment / weak need / …"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={pending || !rejectReason.trim()}
                  variant="outline"
                  onClick={() =>
                    run(() =>
                      rejectLeadAction(detail.lead.id, rejectReason),
                    )
                  }
                >
                  Reject
                </Button>
              </>
            ) : canDecide ? (
              <p className="text-muted-foreground text-body-sm">
                Research must complete before you can accept.
              </p>
            ) : (
              <p className="text-muted-foreground text-body-sm">
                Decision already made — continue to Contact.
              </p>
            )}
          </PanelBody>
        </Surface>
        {detail.signals[0] ? (
          <p className="text-muted-foreground text-body-sm">
            Signal: {detail.signals[0].title} ·{" "}
            <a
              className="underline"
              href={detail.signals[0].sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              source
            </a>
          </p>
        ) : null}
      </aside>
    </div>
  );
}
