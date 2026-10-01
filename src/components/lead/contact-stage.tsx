"use client";

import { useState } from "react";
import { PanelBody, PanelHeader, SectionTitle, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ContactConfidence } from "@/modules/contacts/confidence";
import { addContactAction, checkMxAction, confirmContactAction, harvestContactsAction, suggestPatternsAction } from "@/modules/contacts/actions";
import { isContactEditable, type LeadContact, type StageProps } from "./lead-stage";
import { ResearchPanel } from "./research-panel";

/** Held by the workspace so typed contact details survive switching stages. */
export function useContactForm(recommendedRole: string | null) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(recommendedRole ?? "");
  const [confidence, setConfidence] = useState<ContactConfidence>("manual_confirmed");
  const [patternSuggestions, setPatternSuggestions] = useState<
    Array<{ email: string; pattern: string }>
  >([]);
  const [peopleHints, setPeopleHints] = useState<Array<{ name: string; role: string | null }>>([]);
  const [mxStatus, setMxStatus] = useState<string | null>(null);
  return {
    name, setName, email, setEmail, role, setRole, confidence, setConfidence,
    patternSuggestions, setPatternSuggestions, peopleHints, setPeopleHints, mxStatus, setMxStatus,
  };
}

/**
 * Find and confirm who to write to: website harvest, MX check, email
 * patterns (always unverified), team-page people, or a manual entry.
 */
export function ContactStage({
  detail,
  pending,
  run,
  onShowStage,
  form,
  selectedContactId,
  selectedContact,
  setSelectedContactId,
  setInfo,
}: StageProps & {
  form: ReturnType<typeof useContactForm>;
  selectedContactId: string;
  selectedContact: LeadContact | undefined;
  setSelectedContactId: (id: string) => void;
  setInfo: (message: string | null) => void;
}) {
  const {
    name, setName, email, setEmail, role, setRole, confidence, setConfidence,
    patternSuggestions, setPatternSuggestions, peopleHints, setPeopleHints, mxStatus, setMxStatus,
  } = form;
  const contactEditable = isContactEditable(detail.lead.state);

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <ResearchPanel brief={detail.brief} compact />
      <Surface>
        <PanelHeader>
          <SectionTitle
            title="Confirm contact"
            description={`Role + email required before compose. Recommended: ${detail.lead.recommendedContactRole ?? "—"}.`}
          />
        </PanelHeader>
        <PanelBody>
          {contactEditable ? (
            <details className="bg-subtle rounded-panel">
              <summary className="cursor-pointer px-4 py-3 text-body-sm font-medium select-none">
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
                  <p className="text-muted-foreground text-body-sm">{mxStatus}</p>
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
                  <ul className="space-y-2 text-body-sm">
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
            <p className="text-muted-foreground text-body-sm">
              Accept the lead to enter a contact.
            </p>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
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
              <p className="text-body-sm font-medium">People from team page</p>
              <ul className="text-muted-foreground space-y-2 text-body-sm">
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
            <ul className="space-y-2 text-body-sm">
              {detail.contacts.map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-tile bg-subtle px-3 py-2",
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
                    className="border-input bg-card h-9 rounded-full border px-3 text-body-sm"
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
                        onShowStage("compose");
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
                    onClick={() => onShowStage("compose")}
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
  );
}
