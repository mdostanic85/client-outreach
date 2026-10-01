"use client";

import { PanelBody, PanelHeader, SectionTitle, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateDraftAction, inspectDraftQualityAction, saveDraftAction } from "@/modules/outreach/actions";
import type { DraftEditor } from "./draft-editor";
import type { LeadContact, StageProps } from "./lead-stage";
import { ResearchPanel } from "./research-panel";

/** Generate, edit and quality-check the draft (initial or follow-up). */
export function ComposeStage({
  detail,
  pending,
  run,
  onShowStage,
  editor,
  selectedContact,
  setInfo,
}: StageProps & {
  editor: DraftEditor;
  selectedContact: LeadContact | undefined;
  setInfo: (message: string | null) => void;
}) {
  const { subject, setSubject, body, setBody, qualityIssues, setQualityIssues } = editor;
  const draft = detail.drafts[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <Surface>
        <PanelHeader>
          <SectionTitle
            title="Compose outreach"
            description="Edit subject and body, then review before queuing."
          />
        </PanelHeader>
        <PanelBody>
          {(detail.lead.state === "accepted" ||
            detail.lead.state === "draft_ready") &&
          selectedContact?.email &&
          !draft ? (
            <div className="space-y-4">
              <Button
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const result = await generateDraftAction(
                      detail.lead.id,
                      selectedContact.id,
                    );
                    if (result.ok) {
                      setQualityIssues(result.data.quality.issues);
                      if (!result.data.quality.ok) {
                        setInfo(
                          `Draft created with ${result.data.quality.issues.length} quality issue(s)`,
                        );
                      }
                    }
                    return result;
                  })
                }
              >
                Generate draft
              </Button>
              <details className="bg-subtle rounded-panel">
                <summary className="cursor-pointer px-4 py-3 text-body-sm font-medium select-none">
                  Advanced
                </summary>
                <div className="border-border space-y-3 border-t px-4 pt-4 pb-4">
                  <Button
                    disabled={pending}
                    variant="outline"
                    onClick={() =>
                      run(async () => {
                        const result = await generateDraftAction(
                          detail.lead.id,
                          selectedContact.id,
                          { requestCritique: true },
                        );
                        if (result.ok) {
                          setQualityIssues(result.data.quality.issues);
                        }
                        return result;
                      })
                    }
                  >
                    Generate + critique
                  </Button>
                  <p className="text-muted-foreground text-body-sm">
                    Writes a draft, then runs an extra quality check (uses
                    more AI budget).
                  </p>
                </div>
              </details>
            </div>
          ) : null}

          {(detail.lead.state === "sent" ||
            detail.lead.state === "follow_up_due") &&
          selectedContact?.email ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                variant="secondary"
                onClick={() =>
                  run(async () => {
                    const result = await generateDraftAction(
                      detail.lead.id,
                      selectedContact.id,
                      { kind: "follow_up_1" },
                    );
                    if (result.ok) {
                      setQualityIssues(result.data.quality.issues);
                    }
                    return result;
                  })
                }
              >
                Generate follow-up 1
              </Button>
              <Button
                disabled={pending}
                variant="outline"
                onClick={() =>
                  run(async () => {
                    const result = await generateDraftAction(
                      detail.lead.id,
                      selectedContact.id,
                      { kind: "follow_up_2" },
                    );
                    if (result.ok) {
                      setQualityIssues(result.data.quality.issues);
                    }
                    return result;
                  })
                }
              >
                Generate follow-up 2
              </Button>
            </div>
          ) : null}

          {qualityIssues.length > 0 ? (
            <ul className="space-y-2 rounded-tile bg-destructive-wash px-3 py-2 text-body-sm text-destructive">
              {qualityIssues.map((i) => (
                <li key={`${i.code}-${i.message}`}>
                  {i.code}: {i.message}
                </li>
              ))}
            </ul>
          ) : null}

          {draft ? (
            <>
              <div className="flex flex-wrap gap-2 text-body-sm">
                <Badge variant="outline">{draft.kind}</Badge>
                <Badge variant="secondary">{draft.state}</Badge>
              </div>
              <Card>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid gap-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={subject || draft.subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={draft.state === "sent"}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="body">Body</Label>
                    <Textarea
                      id="body"
                      className="min-h-56"
                      value={body || draft.bodyFinal}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={draft.state === "sent"}
                    />
                  </div>
                </CardContent>
              </Card>
              {draft.state !== "sent" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pending}
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
                    <Button
                      disabled={pending || draft.state === "approved"}
                      variant="secondary"
                      onClick={() => {
                        onShowStage("approve");
                      }}
                    >
                      Review for queue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        const text = `Subject: ${subject || draft.subject}\n\n${body || draft.bodyFinal}`;
                        await navigator.clipboard.writeText(text);
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <details className="bg-subtle rounded-panel">
                    <summary className="cursor-pointer px-4 py-3 text-body-sm font-medium select-none">
                      Advanced
                    </summary>
                    <div className="border-border border-t px-4 pt-4 pb-4">
                      <Button
                        disabled={pending}
                        variant="outline"
                        onClick={() =>
                          run(async () => {
                            const saved = await saveDraftAction(
                              detail.lead.id,
                              draft.id,
                              body || draft.bodyFinal,
                              subject || draft.subject,
                            );
                            if (!saved.ok) return saved;
                            const q = await inspectDraftQualityAction(
                              detail.lead.id,
                              draft.id,
                            );
                            if (q.ok) setQualityIssues(q.data.issues);
                            return q;
                          })
                        }
                      >
                        Check quality
                      </Button>
                    </div>
                  </details>
                </div>
              ) : (
                <Badge>Sent</Badge>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-body-sm">
              {!selectedContact?.email
                ? "Confirm a contact email first."
                : "No draft yet — generate one above."}
            </p>
          )}
        </PanelBody>
      </Surface>

      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <Surface>
          <PanelHeader>
            <SectionTitle title="Recipient" />
          </PanelHeader>
          <PanelBody className="space-y-2 text-body-sm">
            {selectedContact ? (
              <>
                <p className="font-medium">
                  {selectedContact.name ?? "(no name)"}
                </p>
                <p className="text-muted-foreground">
                  {selectedContact.email}
                </p>
                <Badge variant="outline">{selectedContact.confidence}</Badge>
              </>
            ) : (
              <p className="text-muted-foreground">No contact selected.</p>
            )}
            <Button
              size="lg"
              variant="ghost"
              onClick={() => onShowStage("contact")}
            >
              Change contact
            </Button>
          </PanelBody>
        </Surface>
        <ResearchPanel brief={detail.brief} compact />
      </aside>
    </div>
  );
}
