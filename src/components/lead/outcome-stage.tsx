"use client";

import { useState } from "react";
import { PanelBody, PanelHeader, SectionTitle, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markRepliedAction, setFollowUpAction, setLeadStateAction, suppressLeadAction } from "@/modules/leads/actions";
import type { LeadContact, LeadDetail, StageProps } from "./lead-stage";

/** Held by the workspace so a picked date survives switching stages. */
export function useOutcomeForm(detail: LeadDetail) {
  const [followUp, setFollowUp] = useState(detail.lead.followUpAt?.slice(0, 10) ?? "");
  return { followUp, setFollowUp };
}

/** Replies, closing the lead, follow-up date, suppression and the mailbox thread. */
export function OutcomeStage({
  detail,
  pending,
  run,
  onShowStage,
  form,
  selectedContact,
}: StageProps & {
  form: ReturnType<typeof useOutcomeForm>;
  selectedContact: LeadContact | undefined;
}) {
  const { followUp, setFollowUp } = form;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Surface>
        <PanelHeader>
          <SectionTitle
            title="Tracking"
            description="Outcomes, follow-ups, and suppression."
          />
        </PanelHeader>
        <PanelBody>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              disabled={pending}
              onClick={() => run(() => markRepliedAction(detail.lead.id))}
            >
              Mark replied
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() =>
                run(() =>
                  setLeadStateAction(detail.lead.id, "in_conversation"),
                )
              }
            >
              In conversation
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() =>
                run(() => setLeadStateAction(detail.lead.id, "closed_won"))
              }
            >
              Closed won
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() =>
                run(() => setLeadStateAction(detail.lead.id, "closed_lost"))
              }
            >
              Closed lost
            </Button>
            <div className="grid gap-2">
              <Label htmlFor="followup">Follow-up date</Label>
              <Input
                id="followup"
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </div>
            <Button
              disabled={pending || !followUp}
              variant="secondary"
              onClick={() =>
                run(() =>
                  setFollowUpAction(
                    detail.lead.id,
                    new Date(followUp).toISOString(),
                  ),
                )
              }
            >
              Set follow-up
            </Button>
            {(detail.lead.state === "sent" ||
              detail.lead.state === "follow_up_due") &&
            selectedContact?.email ? (
              <Button
                variant="outline"
                onClick={() => onShowStage("compose")}
              >
                Write follow-up
              </Button>
            ) : null}
          </div>
          <details className="bg-subtle rounded-panel">
            <summary className="cursor-pointer px-4 py-3 text-body-sm font-medium select-none">
              Advanced
            </summary>
            <div className="border-border border-t px-4 pt-4 pb-4">
              <Button
                disabled={pending}
                variant="destructive"
                onClick={() =>
                  run(() =>
                    suppressLeadAction(detail.lead.id, "manual_suppression"),
                  )
                }
              >
                Suppress company
              </Button>
              <p className="text-muted-foreground mt-2 text-body-sm">
                Never suggest this company again.
              </p>
            </div>
          </details>
        </PanelBody>
      </Surface>

      {detail.mail.messages.length > 0 ||
      detail.mail.followUps.length > 0 ? (
        <Surface>
          <PanelHeader>
            <SectionTitle
              title="Mailbox thread"
              description="Synced replies and scheduled follow-ups."
            />
          </PanelHeader>
          <PanelBody className="text-body-sm">
            {detail.mail.messages.map((m) => (
              <div key={m.id} className="rounded-tile bg-subtle px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{m.direction}</Badge>
                  {m.classification ? (
                    <Badge variant="secondary">{m.classification}</Badge>
                  ) : null}
                  <span className="text-muted-foreground text-body-sm">
                    {m.createdAt.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <p className="mt-1 font-medium">{m.subject}</p>
                <p className="text-muted-foreground line-clamp-3 text-body-sm">
                  {m.bodyText}
                </p>
              </div>
            ))}
            {detail.mail.followUps.length > 0 ? (
              <ul className="text-muted-foreground space-y-2 text-body-sm">
                {detail.mail.followUps.map((f) => (
                  <li key={f.id}>
                    Follow-up #{f.sequence}: {f.state} · due{" "}
                    {f.dueAt.slice(0, 10)}
                  </li>
                ))}
              </ul>
            ) : null}
          </PanelBody>
        </Surface>
      ) : (
        <Surface>
          <PanelBody className="text-muted-foreground py-10 text-center text-body-sm">
            No mailbox activity yet.
          </PanelBody>
        </Surface>
      )}
    </div>
  );
}
