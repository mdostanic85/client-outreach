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
import { ScoreMark, StatePill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { gmailComposeUrl } from "@/lib/gmail";
import { labelPolicy } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";
import type { ContactConfidence } from "@/modules/leads/actions";
import type { getLeadDetail } from "@/modules/leads/queries";

type Detail = NonNullable<ReturnType<typeof getLeadDetail>>;
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

  const ResearchPanel = ({ compact = false }: { compact?: boolean }) => (
    <Card className={compact ? "lg:sticky lg:top-4" : undefined}>
      <CardHeader>
        <CardTitle>{compact ? "Company snapshot" : "Research"}</CardTitle>
        <CardDescription>
          Need-now evidence, fit, and uncertainty.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
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
                        <p className="text-muted-foreground line-clamp-3 text-xs">
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
                <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-xs">
                  {detail.brief.result.risksAndUnknowns.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {info}
        </p>
      ) : null}

      <div className="border-border flex flex-wrap items-start justify-between gap-6 border-b pb-8">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-display text-[34px] leading-[1.15] font-semibold tracking-tight text-[var(--card-foreground)]">
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
          <p className="text-muted-foreground text-[13px]">
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
        <div className="bg-card border-border flex flex-col items-end rounded-[18px] border px-6 py-5 shadow-[var(--shadow-card)]">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            Score
          </span>
          <ScoreMark
            score={detail.lead.score}
            className="font-display text-[32px] font-semibold"
          />
        </div>
      </div>

      {breakdown ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
          {(
            [
              "needNow",
              "fit",
              "abilityToPay",
              "accessibility",
              "engagementMatch",
            ] as const
          ).map((k) => (
            <span key={k} className="tabular">
              <span className="text-[var(--card-foreground)]/70">{k}</span>{" "}
              {breakdown[k] ?? "—"}
            </span>
          ))}
        </div>
      ) : null}

      <nav className="bg-card border-border flex flex-wrap gap-2 rounded-[18px] border p-1.5 shadow-[var(--shadow-card)]">
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
              <span className="tabular text-muted-foreground mr-2 text-[12px]">
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
            <Card>
              <CardHeader>
                <CardTitle>Decide</CardTitle>
                <CardDescription>
                  Accept unlocks contact confirmation and compose.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
              </CardContent>
            </Card>
            {detail.signals[0] ? (
              <p className="text-muted-foreground text-xs">
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
          <Card>
            <CardHeader>
              <CardTitle>Confirm contact</CardTitle>
              <CardDescription>
                Role + email required before compose. Recommended:{" "}
                {detail.lead.recommendedContactRole ?? "—"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {contactEditable ? (
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
              ) : (
                <p className="text-muted-foreground text-sm">
                  Accept the lead to enter a contact.
                </p>
              )}

              {mxStatus ? (
                <p className="text-muted-foreground text-xs">{mxStatus}</p>
              ) : null}

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
                  <p className="text-xs font-medium">People from team page</p>
                  <ul className="text-muted-foreground space-y-2 text-xs">
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
                            variant="outline"
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
                    {selectedContact?.email ? (
                      <Button
                        variant="secondary"
                        onClick={() => setStageOverride("compose")}
                      >
                        Continue to compose
                      </Button>
                    ) : null}
                  </div>
                  {patternSuggestions.length > 0 ? (
                    <ul className="space-y-2 text-xs">
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
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {stage === "compose" ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle>Compose outreach</CardTitle>
              <CardDescription>
                Edit subject and body, then review before queuing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(detail.lead.state === "accepted" ||
                detail.lead.state === "draft_ready") &&
              selectedContact?.email &&
              !draft ? (
                <div className="flex flex-wrap gap-2">
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
                <ul className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {qualityIssues.map((i) => (
                    <li key={`${i.code}-${i.message}`}>
                      {i.code}: {i.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              {draft ? (
                <>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{draft.kind}</Badge>
                    <Badge variant="secondary">{draft.state}</Badge>
                  </div>
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
                  {draft.state !== "sent" ? (
                    <div className="flex flex-wrap gap-2">
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
                      <Button
                        disabled={pending || draft.state === "approved"}
                        onClick={() => {
                          setApproveMode(true);
                          setStageOverride("approve");
                        }}
                      >
                        Review for queue
                      </Button>
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
            </CardContent>
          </Card>

          <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Recipient</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
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
              </CardContent>
            </Card>
            <ResearchPanel compact />
          </aside>
        </div>
      ) : null}

      {stage === "approve" && draft ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader>
              <CardTitle>Approve to send queue</CardTitle>
              <CardDescription>
                Read-only preview. Approving adds this message to the outbound
                queue — it does not send immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p className="text-muted-foreground text-xs">To</p>
                <p className="font-medium">
                  {selectedContact?.email ?? "—"}
                </p>
                <Separator className="my-3" />
                <p className="text-muted-foreground text-xs">Subject</p>
                <p className="font-medium">{subject || draft.subject}</p>
                <Separator className="my-3" />
                <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                  {body || draft.bodyFinal}
                </pre>
              </div>
              {detail.mail.approvals[0] ? (
                <p className="text-muted-foreground text-xs">
                  Latest approval: {detail.mail.approvals[0].status}
                  {detail.mail.approvals[0].status === "invalidated"
                    ? " (edit invalidated hash — re-approve)"
                    : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
                {draft.state === "approved" ? (
                  <Link
                    href="/queue"
                    className="hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-[15px] font-medium"
                  >
                    Open send queue →
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}

      {stage === "approve" && !draft ? (
        <Card>
          <CardContent className="py-10 text-center">
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
          </CardContent>
        </Card>
      ) : null}

      {stage === "outcome" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tracking</CardTitle>
              <CardDescription>
                Outcomes, follow-ups, and suppression.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <Button
                disabled={pending}
                variant="secondary"
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
            </CardContent>
          </Card>

          {detail.mail.messages.length > 0 ||
          detail.mail.followUps.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Mailbox thread</CardTitle>
                <CardDescription>
                  Synced replies and scheduled follow-ups.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                {detail.mail.messages.map((m) => (
                  <div key={m.id} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{m.direction}</Badge>
                      {m.classification ? (
                        <Badge variant="secondary">{m.classification}</Badge>
                      ) : null}
                      <span className="text-muted-foreground text-xs">
                        {m.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">{m.subject}</p>
                    <p className="text-muted-foreground line-clamp-3 text-xs">
                      {m.bodyText}
                    </p>
                  </div>
                ))}
                {detail.mail.followUps.length > 0 ? (
                  <ul className="text-muted-foreground space-y-2 text-xs">
                    {detail.mail.followUps.map((f) => (
                      <li key={f.id}>
                        Follow-up #{f.sequence}: {f.state} · due{" "}
                        {f.dueAt.slice(0, 10)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                No mailbox activity yet.
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
