"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  acceptLeadAction,
  addContactAction,
  approveDraftAction,
  checkMxAction,
  confirmContactAction,
  generateDraftAction,
  harvestContactsAction,
  inspectDraftQualityAction,
  markRepliedAction,
  markSentAction,
  rejectLeadAction,
  researchLeadAction,
  saveDraftAction,
  saveForLaterAction,
  setFollowUpAction,
  setLeadStateAction,
  suggestPatternsAction,
  suppressLeadAction,
} from "@/app/actions";
import { InlineAlert } from "@/components/inline-alert";
import {
  PanelBody,
  PanelHeader,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import { ScoreBadge } from "@/components/score-badge";
import { StickyFormActions } from "@/components/sticky-form-actions";
import { StatePill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { gmailComposeUrl } from "@/lib/gmail";
import { labelPolicy } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";
import type { ContactConfidence } from "@/modules/leads/actions";
import type { getLeadDetail } from "@/modules/leads/queries";

type Detail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;
type Stage = "review" | "contact" | "compose" | "approve" | "outcome";

const DECISION_STATES = ["suggested", "researched", "saved_for_later", "new"];
const OUTCOME_STATES = [
  "sent",
  "follow_up_due",
  "replied",
  "in_conversation",
  "closed_won",
  "closed_lost",
];

function resolveStage(detail: Detail): Stage {
  const state = detail.lead.state;
  if (DECISION_STATES.includes(state)) return "review";
  if (OUTCOME_STATES.includes(state)) return "outcome";

  const hasEmail = detail.contacts.some((c) => c.email);
  const draft = detail.drafts[0];

  if (!hasEmail) return "contact";
  if (draft?.state === "approved") return "approve";
  if (draft || state === "draft_ready" || state === "accepted") return "compose";
  return "contact";
}

const STAGES: { id: Stage; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "contact", label: "Contact" },
  { id: "compose", label: "Compose" },
  { id: "approve", label: "Approve" },
  { id: "outcome", label: "Outcome" },
];

const SCORE_DIMENSION_TOOLTIPS: Record<string, string> = {
  needNow: "Evidence the company is hiring or actively needing help soon.",
  fit: "How well your positioning matches this company's need.",
  abilityToPay: "Signals they can afford help.",
  accessibility: "How reachable the right contact looks.",
  engagementMatch: "Alignment with how you prefer to engage.",
};

const SCORE_DIMENSION_LABELS: Record<string, string> = {
  needNow: "Need now",
  fit: "Fit",
  abilityToPay: "Ability to pay",
  accessibility: "Accessibility",
  engagementMatch: "Engagement match",
};

export function LeadWorkspace({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(detail.lead.recommendedContactRole ?? "");
  const [confidence, setConfidence] =
    useState<ContactConfidence>("manual_confirmed");
  const [rejectReason, setRejectReason] = useState("");
  const [followUp, setFollowUp] = useState(
    detail.lead.followUpAt?.slice(0, 10) ?? "",
  );
  const [selectedContactId, setSelectedContactId] = useState(
    detail.contacts.find((c) => c.email)?.id ?? detail.contacts[0]?.id ?? "",
  );
  const [patternSuggestions, setPatternSuggestions] = useState<
    Array<{ email: string; pattern: string }>
  >([]);
  const [peopleHints, setPeopleHints] = useState<
    Array<{ name: string; role: string | null }>
  >([]);
  const [mxStatus, setMxStatus] = useState<string | null>(null);
  const [qualityIssues, setQualityIssues] = useState<
    Array<{ code: string; message: string }>
  >([]);
  const [stageOverride, setStageOverride] = useState<Stage | null>(null);
  const [approveMode, setApproveMode] = useState(false);

  const draft = detail.drafts[0];
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.bodyFinal ?? "");

  const selectedContact = useMemo(
    () => detail.contacts.find((c) => c.id === selectedContactId),
    [detail.contacts, selectedContactId],
  );

  const breakdown = detail.lead.scoreBreakdownJson
    ? (JSON.parse(detail.lead.scoreBreakdownJson) as Record<string, number>)
    : null;

  const autoStage = resolveStage(detail);
  const stage =
    stageOverride ??
    (approveMode && draft && draft.state !== "sent" ? "approve" : autoStage);

  useEffect(() => {
    if (draft) {
      setSubject(draft.subject);
      setBody(draft.bodyFinal);
    }
  }, [draft?.id, draft?.subject, draft?.bodyFinal]);

  useEffect(() => {
    if (
      !selectedContactId ||
      !detail.contacts.some((c) => c.id === selectedContactId)
    ) {
      setSelectedContactId(
        detail.contacts.find((c) => c.email)?.id ?? detail.contacts[0]?.id ?? "",
      );
    }
  }, [detail.contacts, selectedContactId]);

  useEffect(() => {
    setStageOverride(null);
    setApproveMode(false);
  }, [detail.lead.state, detail.drafts[0]?.state, detail.contacts.length]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else router.refresh();
    });
  };

  const canDecide = DECISION_STATES.includes(detail.lead.state);
  const contactEditable =
    detail.lead.state === "accepted" ||
    detail.lead.state === "draft_ready" ||
    detail.lead.state === "sent" ||
    detail.lead.state === "follow_up_due" ||
    detail.lead.state === "replied";

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  const draftDirty =
    draft &&
    draft.state !== "sent" &&
    (subject !== draft.subject || body !== draft.bodyFinal);

  const ResearchPanel = ({ compact = false }: { compact?: boolean }) => (
    <Surface className={compact ? "lg:sticky lg:top-4" : undefined}>
      <PanelHeader>
        <SectionTitle
          title={compact ? "Company snapshot" : "Research"}
          description="Need-now evidence, fit, and uncertainty."
        />
      </PanelHeader>
      <PanelBody className="text-sm">
        {!detail.brief ? (
          <p className="text-muted-foreground">No research yet.</p>
        ) : (
          <>
            <p className={compact ? "line-clamp-4" : undefined}>
              {detail.brief.result.companySummary}
            </p>
            {!compact ? <Separator /> : null}
            <div>
              <p className="mb-1 font-medium">Need signals</p>
              <ul className="list-disc space-y-2 pl-5">
                {detail.brief.result.currentNeedSignals
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
                {detail.brief.result.fitReasons
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
                    {detail.brief.result.risksAndUnknowns.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-medium">Evidence</p>
                  <ul className="space-y-2">
                    {detail.brief.evidence.map((e) => (
                      <li key={e.id} className="rounded-md bg-muted/50 p-2">
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
                        <p className="text-muted-foreground line-clamp-3 text-sm">
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
                <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
                  {detail.brief.result.risksAndUnknowns.slice(0, 3).map((r) => (
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

  return (
    <div className="space-y-8">
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {info ? <InlineAlert variant="info">{info}</InlineAlert> : null}

      <header className="border-border flex flex-wrap items-start justify-between gap-6 border-b pb-8">
        <div className="min-w-0 max-w-3xl space-y-4">
          <nav className="text-muted-foreground text-[13px] font-medium tracking-wide">
            <Link
              href="/"
              className="hover:text-foreground transition-colors"
            >
              Today · Companies
            </Link>
            <span> / {detail.company.name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-display text-[34px] leading-[1.15] font-semibold tracking-tight text-balance text-[var(--card-foreground)]">
              {detail.company.name}
            </h1>
            <StatePill state={detail.lead.state} />
          </div>
          <p className="text-muted-foreground text-[16px]">
            {[detail.company.domain ?? "No domain", detail.company.country]
              .filter(Boolean)
              .join(" · ")}
            {" · "}
            research {detail.lead.researchStatus}
          </p>
          <p className="text-muted-foreground text-[15px]">
            {labelPolicy(detail.policy.policy)}
            {detail.policy.code ? ` · ${detail.policy.code}` : ""}
            {detail.lead.recommendedContactRole
              ? ` · Role: ${detail.lead.recommendedContactRole}`
              : ""}
            {detail.lead.recommendedAngle
              ? ` · Angle: ${detail.lead.recommendedAngle}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 pt-1">
          <ScoreBadge score={detail.lead.score} kind="fit" />
        </div>
      </header>

      {breakdown ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 text-[15px]">
          {(
            [
              "needNow",
              "fit",
              "abilityToPay",
              "accessibility",
              "engagementMatch",
            ] as const
          ).map((k) => (
            <Tooltip key={k}>
              <TooltipTrigger
                render={
                  <span
                    className="tabular cursor-help underline decoration-dotted underline-offset-4"
                  />
                }
              >
                <span className="text-[var(--card-foreground)]/70">
                  {SCORE_DIMENSION_LABELS[k]}
                </span>{" "}
                {breakdown[k] ?? "—"}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left leading-relaxed">
                {SCORE_DIMENSION_TOOLTIPS[k]}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : null}

      <nav className="bg-card border-border flex flex-wrap gap-2 rounded-[18px] border p-1.5">
        {STAGES.map((s, i) => {
          const autoIndex = STAGES.findIndex((x) => x.id === autoStage);
          const unlocked = i <= Math.max(autoIndex, stageIndex);
          const active = s.id === stage;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!unlocked}
              onClick={() => {
                setApproveMode(s.id === "approve");
                setStageOverride(s.id === autoStage ? null : s.id);
              }}
              className={cn(
                "flex-1 rounded-xl px-4 py-3 text-left text-[15px] transition-colors duration-150 sm:min-w-28",
                active
                  ? "bg-accent-wash text-primary font-semibold"
                  : unlocked
                    ? "text-[var(--card-foreground)] hover:bg-white/5"
                    : "text-muted-foreground/40",
              )}
            >
              <span className="tabular text-muted-foreground mr-2 text-[14px]">
                {i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </nav>

      {stage === "review" ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <ResearchPanel />
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
                  <p className="text-muted-foreground text-sm">
                    Research must complete before you can accept.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Decision already made — continue to Contact.
                  </p>
                )}
              </PanelBody>
            </Surface>
            {detail.signals[0] ? (
              <p className="text-muted-foreground text-sm">
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
      ) : null}

      {stage === "contact" ? (
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <ResearchPanel compact />
          <Surface>
            <PanelHeader>
              <SectionTitle
                title="Confirm contact"
                description={`Role + email required before compose. Recommended: ${detail.lead.recommendedContactRole ?? "—"}.`}
              />
            </PanelHeader>
            <PanelBody>
              {contactEditable ? (
                <details className="border-border rounded-xl border">
                  <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium select-none">
                    Advanced
                  </summary>
                  <div className="border-border space-y-4 border-t px-4 pt-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={pending || !detail.company.domain}
                        variant="secondary"
                        onClick={() =>
                          run(async () => {
                            const result = await harvestContactsAction(
                              detail.lead.id,
                            );
                            if (result.ok) {
                              setPeopleHints(result.data.people ?? []);
                              setInfo(
                                `Harvest: ${result.data.contactsCreated} new / ${result.data.emailsFound} emails found`,
                              );
                            }
                            return result;
                          })
                        }
                      >
                        Harvest website contacts
                      </Button>
                      {detail.company.domain ? (
                        <Button
                          disabled={pending}
                          variant="outline"
                          onClick={() =>
                            run(async () => {
                              const result = await checkMxAction(
                                detail.company.domain!,
                              );
                              if (result.ok) {
                                setMxStatus(
                                  result.data.ok
                                    ? `MX ok: ${result.data.hosts.slice(0, 2).join(", ")}`
                                    : `MX fail: ${result.data.error ?? "no records"}`,
                                );
                              }
                              return result;
                            })
                          }
                        >
                          Check MX
                        </Button>
                      ) : null}
                    </div>
                    {mxStatus ? (
                      <p className="text-muted-foreground text-sm">{mxStatus}</p>
                    ) : null}
                    <Button
                      disabled={pending || !name || !detail.company.domain}
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          const result = await suggestPatternsAction({
                            leadId: detail.lead.id,
                            companyId: detail.company.id,
                            fullName: name,
                            domain: detail.company.domain!,
                            role: role || undefined,
                          });
                          if (result.ok) {
                            setPatternSuggestions(result.data.suggestions);
                          }
                          return result;
                        })
                      }
                    >
                      Suggest patterns
                    </Button>
                    {patternSuggestions.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        <li className="text-muted-foreground">
                          Patterns are unverified — confirm manually before send.
                        </li>
                        {patternSuggestions.map((s) => (
                          <li key={s.email}>
                            <button
                              type="button"
                              className="underline"
                              onClick={() => {
                                setEmail(s.email);
                                setConfidence("pattern_unverified");
                              }}
                            >
                              {s.email}
                            </button>{" "}
                            <span className="text-muted-foreground">
                              ({s.pattern})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Accept the lead to enter a contact.
                </p>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {(
                  [
                    ["Team page", detail.lookupLinks.teamPage],
                    ["Contact page", detail.lookupLinks.contactPage],
                    ["LinkedIn search", detail.lookupLinks.linkedInCompany],
                    ["Web search", detail.lookupLinks.webSearch],
                  ] as const
                ).map(([label, href]) => (
                  <a
                    key={label}
                    className="underline"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label}
                  </a>
                ))}
              </div>

              {peopleHints.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">People from team page</p>
                  <ul className="text-muted-foreground space-y-2 text-sm">
                    {peopleHints.map((p) => (
                      <li key={`${p.name}-${p.role}`}>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setName(p.name);
                            setRole(p.role ?? role);
                          }}
                        >
                          {p.name}
                          {p.role ? ` · ${p.role}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detail.contacts.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {detail.contacts.map((c) => (
                    <li
                      key={c.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2",
                        selectedContactId === c.id && "border-foreground/40",
                      )}
                    >
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelectedContactId(c.id)}
                      >
                        <p className="font-medium">
                          {c.name ?? "(no name)"}
                          {c.role ? ` · ${c.role}` : ""}
                        </p>
                        <p className="text-muted-foreground">
                          {c.email ?? "no email"}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            c.confidence === "pattern_unverified" ||
                            c.confidence === "unknown"
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {c.confidence}
                        </Badge>
                        {c.confidence === "pattern_unverified" ? (
                          <Button
                            size="lg"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                confirmContactAction(c.id, detail.lead.id),
                              )
                            }
                          >
                            Confirm
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {contactEditable ? (
                <div className="grid gap-6">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="role">Role</Label>
                      <Input
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confidence">Confidence</Label>
                      <select
                        id="confidence"
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                        value={confidence}
                        onChange={(e) =>
                          setConfidence(e.target.value as ContactConfidence)
                        }
                      >
                        <option value="manual_confirmed">manual_confirmed</option>
                        <option value="published_personal">
                          published_personal
                        </option>
                        <option value="published_generic">
                          published_generic
                        </option>
                        <option value="provider_verified">
                          provider_verified
                        </option>
                        <option value="pattern_unverified">
                          pattern_unverified
                        </option>
                        <option value="unknown">unknown</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pending || !name || !email}
                      onClick={() =>
                        run(async () => {
                          const result = await addContactAction({
                            companyId: detail.company.id,
                            leadId: detail.lead.id,
                            name,
                            email,
                            role: role || undefined,
                            confidence,
                          });
                          if (result.ok) {
                            setName("");
                            setEmail("");
                            setSelectedContactId(result.data.contactId);
                            setStageOverride("compose");
                          }
                          return result;
                        })
                      }
                    >
                      Save contact & continue
                    </Button>
                    {selectedContact?.email ? (
                      <Button
                        variant="secondary"
                        onClick={() => setStageOverride("compose")}
                      >
                        Continue to compose
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </PanelBody>
          </Surface>
        </div>
      ) : null}

      {stage === "compose" ? (
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
                  <details className="border-border rounded-xl border">
                    <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium select-none">
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
                      <p className="text-muted-foreground text-[13px]">
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
                <ul className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {qualityIssues.map((i) => (
                    <li key={`${i.code}-${i.message}`}>
                      {i.code}: {i.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              {draft ? (
                <>
                  <div className="flex flex-wrap gap-2 text-sm">
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
                            setApproveMode(true);
                            setStageOverride("approve");
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
                      <details className="border-border rounded-xl border">
                        <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium select-none">
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
                <p className="text-muted-foreground text-sm">
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
              <PanelBody className="space-y-2 text-sm">
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
                  onClick={() => setStageOverride("contact")}
                >
                  Change contact
                </Button>
              </PanelBody>
            </Surface>
            <ResearchPanel compact />
          </aside>
        </div>
      ) : null}

      {stage === "approve" && draft ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <Surface>
            <PanelHeader>
              <SectionTitle
                title="Approve to send queue"
                description="Read-only preview. Approving adds this message to the outbound queue — it does not send immediately."
              />
            </PanelHeader>
            <PanelBody>
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p className="text-muted-foreground text-sm">To</p>
                <p className="font-medium">
                  {selectedContact?.email ?? "—"}
                </p>
                <Separator className="my-3" />
                <p className="text-muted-foreground text-sm">Subject</p>
                <p className="font-medium">{subject || draft.subject}</p>
                <Separator className="my-3" />
                <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                  {body || draft.bodyFinal}
                </pre>
              </div>
              {detail.mail.approvals[0] ? (
                <p className="text-muted-foreground text-sm">
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
                    setApproveMode(false);
                    setStageOverride("compose");
                  }}
                >
                  Edit draft
                </Button>
                <a
                  className="border-border bg-background hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-xl border px-4 text-[15px] font-medium"
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
                <details className="border-border rounded-xl border">
                  <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium select-none">
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
                    className="hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-[15px] font-medium"
                  >
                    Open send queue →
                  </Link>
                ) : null}
              </PanelBody>
            </Surface>
          </aside>
        </div>
      ) : null}

      {stage === "approve" && !draft ? (
        <Surface>
          <PanelBody className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              No draft to approve yet.
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => setStageOverride("compose")}
            >
              Go to compose
            </Button>
          </PanelBody>
        </Surface>
      ) : null}

      {stage === "outcome" ? (
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
                    onClick={() => setStageOverride("compose")}
                  >
                    Write follow-up
                  </Button>
                ) : null}
              </div>
              <details className="border-border rounded-xl border">
                <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium select-none">
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
                  <p className="text-muted-foreground mt-2 text-[13px]">
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
              <PanelBody className="text-sm">
                {detail.mail.messages.map((m) => (
                  <div key={m.id} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{m.direction}</Badge>
                      {m.classification ? (
                        <Badge variant="secondary">{m.classification}</Badge>
                      ) : null}
                      <span className="text-muted-foreground text-sm">
                        {m.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">{m.subject}</p>
                    <p className="text-muted-foreground line-clamp-3 text-sm">
                      {m.bodyText}
                    </p>
                  </div>
                ))}
                {detail.mail.followUps.length > 0 ? (
                  <ul className="text-muted-foreground space-y-2 text-sm">
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
              <PanelBody className="text-muted-foreground py-10 text-center text-sm">
                No mailbox activity yet.
              </PanelBody>
            </Surface>
          )}
        </div>
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
