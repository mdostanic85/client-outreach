"use client";

import { useState } from "react";
import { InlineAlert } from "@/components/inline-alert";
import { ApproveStage } from "@/components/lead/approve-stage";
import { ComposeStage } from "@/components/lead/compose-stage";
import { ContactStage, useContactForm } from "@/components/lead/contact-stage";
import { useDraftEditor } from "@/components/lead/draft-editor";
import { LeadHeader } from "@/components/lead/lead-header";
import {
  defaultContactId,
  resolveStage,
  STAGES,
  type LeadDetail,
  type Stage,
} from "@/components/lead/lead-stage";
import { OutcomeStage, useOutcomeForm } from "@/components/lead/outcome-stage";
import { ReviewStage, useReviewForm } from "@/components/lead/review-stage";
import { StickyFormActions } from "@/components/sticky-form-actions";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";
import { cn } from "@/lib/utils";
import { saveDraftAction } from "@/modules/outreach/actions";

/**
 * One client lead, from research to outcome. This component only decides
 * which stage shows and holds state shared across stages; each stage lives
 * in `components/lead/`.
 */
export function LeadWorkspace({ detail }: { detail: LeadDetail }) {
  const { pending, error, message: info, setMessage: setInfo, run } = useActionRunner();

  const reviewForm = useReviewForm();
  const contactForm = useContactForm(detail.lead.recommendedContactRole);
  const outcomeForm = useOutcomeForm(detail);
  const draft = detail.drafts[0];
  const editor = useDraftEditor(draft);

  // A picked contact that disappears from the lead falls back to the default one.
  const [chosenContactId, setSelectedContactId] = useState(defaultContactId(detail));
  const selectedContactId = detail.contacts.some((c) => c.id === chosenContactId)
    ? chosenContactId
    : defaultContactId(detail);
  const selectedContact = detail.contacts.find((c) => c.id === selectedContactId);

  // The stage follows the lead; a manual pick lasts until the lead moves on.
  const autoStage = resolveStage(detail);
  const [stageOverride, setStageOverride] = useState<Stage | null>(null);
  const progressKey = `${detail.lead.state}|${draft?.state ?? ""}|${detail.contacts.length}`;
  const [seenProgressKey, setSeenProgressKey] = useState(progressKey);
  if (progressKey !== seenProgressKey) {
    setSeenProgressKey(progressKey);
    setStageOverride(null);
  }
  const stage = stageOverride ?? autoStage;
  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  const stageProps = { detail, pending, run, onShowStage: setStageOverride };
  const { subject, body, dirty: draftDirty } = editor;

  return (
    <div className="space-y-8">
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {info ? <InlineAlert variant="info">{info}</InlineAlert> : null}

      <LeadHeader detail={detail} />

      <nav className="bg-card border-border flex flex-wrap gap-2 rounded-card border p-1.5 shadow-card">
        {STAGES.map((s, i) => {
          const autoIndex = STAGES.findIndex((x) => x.id === autoStage);
          const unlocked = i <= Math.max(autoIndex, stageIndex);
          const active = s.id === stage;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!unlocked}
              onClick={() => setStageOverride(s.id === autoStage ? null : s.id)}
              className={cn(
                "flex-1 rounded-xl px-4 py-3 text-left text-body transition-colors duration-150 sm:min-w-28",
                active
                  ? "bg-accent-wash text-brand-ink font-medium"
                  : unlocked
                    ? "text-foreground hover:bg-subtle"
                    : "text-muted-foreground/40",
              )}
            >
              <span className="tabular text-muted-foreground mr-2 text-body-sm">
                {i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </nav>

      {stage === "review" ? <ReviewStage {...stageProps} form={reviewForm} /> : null}
      {stage === "contact" ? (
        <ContactStage
          {...stageProps}
          form={contactForm}
          selectedContactId={selectedContactId}
          selectedContact={selectedContact}
          setSelectedContactId={setSelectedContactId}
          setInfo={setInfo}
        />
      ) : null}
      {stage === "compose" ? (
        <ComposeStage
          {...stageProps}
          editor={editor}
          selectedContact={selectedContact}
          setInfo={setInfo}
        />
      ) : null}
      {stage === "approve" ? (
        <ApproveStage {...stageProps} editor={editor} selectedContact={selectedContact} />
      ) : null}
      {stage === "outcome" ? (
        <OutcomeStage {...stageProps} form={outcomeForm} selectedContact={selectedContact} />
      ) : null}

      {draft && draftDirty && stage === "approve" && draft.state !== "sent" ? (
        <StickyFormActions message="You have unsaved draft changes.">
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() =>
              run(() =>
                saveDraftAction(
                  detail.lead.id,
                  draft.id,
                  body || draft.bodyFinal,
                  subject || draft.subject,
                ),
              )
            }
          >
            Save edits
          </Button>
        </StickyFormActions>
      ) : null}
    </div>
  );
}
