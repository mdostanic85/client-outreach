"use client";

import Link from "next/link";
import { PanelBody, PanelHeader, SectionTitle, Surface } from "@/components/page-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { gmailComposeUrl } from "@/lib/gmail";
import { approveDraftAction } from "@/modules/mail/actions";
import { markSentAction, saveDraftAction } from "@/modules/outreach/actions";
import type { DraftEditor } from "./draft-editor";
import type { LeadContact, StageProps } from "./lead-stage";

/** Read-only preview; approving queues the message, it does not send it. */
export function ApproveStage({
  detail,
  pending,
  run,
  onShowStage,
  editor,
  selectedContact,
}: StageProps & { editor: DraftEditor; selectedContact: LeadContact | undefined }) {
  const { subject, body } = editor;
  const draft = detail.drafts[0];

  if (!draft) {
    return (
      <Surface>
        <PanelBody className="py-10 text-center">
          <p className="text-muted-foreground text-body-sm">
            No draft to approve yet.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => onShowStage("compose")}
          >
            Go to compose
          </Button>
        </PanelBody>
      </Surface>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <Surface>
        <PanelHeader>
          <SectionTitle
            title="Approve to send queue"
            description="Read-only preview. Approving adds this message to the outbound queue — it does not send immediately."
          />
        </PanelHeader>
        <PanelBody>
          <div className="bg-subtle rounded-tile p-4 text-body-sm">
            <p className="text-muted-foreground text-body-sm">To</p>
            <p className="font-medium">
              {selectedContact?.email ?? "—"}
            </p>
            <Separator className="my-3" />
            <p className="text-muted-foreground text-body-sm">Subject</p>
            <p className="font-medium">{subject || draft.subject}</p>
            <Separator className="my-3" />
            <pre className="whitespace-pre-wrap font-sans leading-relaxed">
              {body || draft.bodyFinal}
            </pre>
          </div>
          {detail.mail.approvals[0] ? (
            <p className="text-muted-foreground text-body-sm">
              Latest approval: {detail.mail.approvals[0].status}
              {detail.mail.approvals[0].status === "invalidated"
                ? " (edit invalidated hash — re-approve)"
                : ""}
            </p>
          ) : null}
        </PanelBody>
      </Surface>
      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <Surface>
          <PanelHeader>
            <SectionTitle title="Actions" />
          </PanelHeader>
          <PanelBody className="space-y-2">
            <Button
              className="w-full"
              disabled={pending || draft.state === "approved"}
              onClick={() =>
                run(async () => {
                  const saved = await saveDraftAction(
                    detail.lead.id,
                    draft.id,
                    body || draft.bodyFinal,
                    subject || draft.subject,
                  );
                  if (!saved.ok) return saved;
                  return approveDraftAction(detail.lead.id, draft.id);
                })
              }
            >
              {draft.state === "approved"
                ? "Already in queue"
                : "Approve to queue"}
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                onShowStage("compose");
              }}
            >
              Edit draft
            </Button>
            <a
              className={buttonVariants({ variant: "outline", className: "w-full" })}
              href={gmailComposeUrl(
                subject || draft.subject,
                body || draft.bodyFinal,
                selectedContact?.email ?? detail.contacts[0]?.email,
              )}
              target="_blank"
              rel="noreferrer"
            >
              Open Gmail
            </a>
            <details className="bg-subtle rounded-panel">
              <summary className="cursor-pointer px-4 py-3 text-body-sm font-medium select-none">
                Advanced
              </summary>
              <div className="border-border space-y-2 border-t px-4 pt-4 pb-4">
                <Button
                  className="w-full"
                  disabled={pending}
                  variant="outline"
                  onClick={() =>
                    run(() => markSentAction(detail.lead.id, draft.id))
                  }
                >
                  Mark sent (manual)
                </Button>
              </div>
            </details>
            {draft.state === "approved" ? (
              <Link
                href="/queue"
                className="hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-body font-medium"
              >
                Open send queue →
              </Link>
            ) : null}
          </PanelBody>
        </Surface>
      </aside>
    </div>
  );
}
