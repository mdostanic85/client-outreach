"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addProfileFactAction, removeProfileFactAction, updateProfileFactAction } from "@/modules/profile/actions";
import { InlineAlert } from "@/components/inline-alert";
import { PanelBody, PanelHeader, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCompensation,
  type StructuredProfile,
} from "@/modules/profile/schemas";
import { isPortfolioProjectEvidence } from "@/modules/profile/matching-sources-core";
import { cn } from "@/lib/utils";

function SourceBadges({ sources }: { sources: string[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <Badge key={s} variant="outline" className="h-6 px-2 text-caption">
          {s}
        </Badge>
      ))}
    </div>
  );
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  cv: "Uploaded CV",
  linkedin_text: "LinkedIn",
  portfolio_url: "Portfolio website",
  manual: "Manual input",
  document: "Document",
  github: "GitHub",
};

export function sourceTypeLabel(type: string): string {
  return SOURCE_TYPE_LABEL[type] ?? type;
}

type EditableProps = {
  profileId: string | null;
  canEdit: boolean;
};

function FactActions({
  onEdit,
  onRemove,
  disabled,
}: {
  onEdit?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {onEdit ? (
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onEdit}>
          Edit
        </Button>
      ) : null}
      {onRemove ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={onRemove}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
}

export function ProfessionalProfileView({
  profile,
  profileId,
  canEdit = false,
  sourceLabels,
  portfolioProjectsExcludedFromMatching,
}: {
  profile: StructuredProfile;
  profileId?: string | null;
  canEdit?: boolean;
  sourceLabels?: string[];
  portfolioProjectsExcludedFromMatching?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [addingField, setAddingField] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");

  const editable: EditableProps = {
    profileId: profileId ?? null,
    canEdit: Boolean(canEdit && profileId),
  };

  const run = (
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Update failed");
        return;
      }
      setMessage(label);
      setEditingKey(null);
      setAddingField(null);
      setAddValue("");
      router.refresh();
    });
  };

  const fs = profile.fieldSources ?? {};
  const pay =
    formatCompensation(profile.compensation) ??
    profile.salaryOrRateExpectations;
  const portfolioProjects = profile.relevantProjects.filter((p) =>
    isPortfolioProjectEvidence(p),
  );
  const otherProjects = profile.relevantProjects.filter(
    (p) => !isPortfolioProjectEvidence(p),
  );

  const hasAny =
    Boolean(profile.currentRole) ||
    Boolean(profile.professionalSummary) ||
    profile.strongestSkills.length > 0 ||
    profile.relevantProjects.length > 0 ||
    profile.industries.length > 0;

  const saveScalar = (field: string, value: string) => {
    if (!editable.profileId) return;
    run("Fact updated", () =>
      updateProfileFactAction({
        profileId: editable.profileId!,
        field,
        value,
      }),
    );
  };

  const removeScalar = (field: string) => {
    if (!editable.profileId) return;
    run("Fact removed", () =>
      removeProfileFactAction({
        profileId: editable.profileId!,
        field,
      }),
    );
  };

  const removeListItem = (field: string, index: number, value: string) => {
    if (!editable.profileId) return;
    run("Fact removed", () =>
      removeProfileFactAction({
        profileId: editable.profileId!,
        field,
        index,
        value,
      }),
    );
  };

  const saveListItem = (field: string, index: number, value: string) => {
    if (!editable.profileId) return;
    run("Fact updated", () =>
      updateProfileFactAction({
        profileId: editable.profileId!,
        field,
        index,
        value,
      }),
    );
  };

  const addListItem = (field: string) => {
    if (!editable.profileId || !addValue.trim()) return;
    run("Fact added", () =>
      addProfileFactAction({
        profileId: editable.profileId!,
        field,
        value: addValue.trim(),
      }),
    );
  };

  const renderScalar = (
    field: string,
    label: string,
    value: string | number | null | undefined,
    multiline = false,
  ) => {
    if (value == null || value === "") {
      if (!editable.canEdit) return null;
      return (
        <div className="space-y-2">
          <p className="text-muted-foreground text-body-sm font-medium">
            {label}
          </p>
          {addingField === field ? (
            <div className="flex flex-wrap gap-2">
              {multiline ? (
                <Textarea
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  className="min-h-20"
                />
              ) : (
                <Input
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                />
              )}
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  saveScalar(field, addValue);
                  setAddingField(null);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingField(null);
                  setAddValue("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setAddingField(field);
                setAddValue("");
              }}
            >
              Add {label.toLowerCase()}
            </Button>
          )}
        </div>
      );
    }

    const key = `scalar:${field}`;
    const display = String(value);
    return (
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground text-body-sm font-medium">
            {label}
          </p>
          {editable.canEdit ? (
            <FactActions
              disabled={pending}
              onEdit={() => {
                setEditingKey(key);
                setDraftValue(display);
              }}
              onRemove={() => removeScalar(field)}
            />
          ) : null}
        </div>
        {editingKey === key ? (
          <div className="space-y-2">
            {multiline ? (
              <Textarea
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                className="min-h-24"
              />
            ) : (
              <Input
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => saveScalar(field, draftValue)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingKey(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-body leading-relaxed text-foreground">
            {display}
          </div>
        )}
        <SourceBadges sources={fs[field]} />
      </div>
    );
  };

  const renderChips = (field: string, label: string, items: string[]) => {
    if (!items.length && !editable.canEdit) return null;
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-body-sm font-medium">
          {label}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, index) => {
            const key = `list:${field}:${index}`;
            return (
              <li
                key={key}
                className="bg-subtle flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-body-sm"
              >
                {editingKey === key ? (
                  <Input
                    className="h-8 w-40"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveListItem(field, index, draftValue);
                      }
                    }}
                  />
                ) : (
                  <span>{item}</span>
                )}
                {editable.canEdit ? (
                  <span className="flex">
                    {editingKey === key ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => saveListItem(field, index, draftValue)}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5 text-caption"
                        disabled={pending}
                        onClick={() => {
                          setEditingKey(key);
                          setDraftValue(item);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1.5 text-caption"
                      disabled={pending}
                      onClick={() => removeListItem(field, index, item)}
                    >
                      ×
                    </Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <SourceBadges sources={fs[field]} />
        {editable.canEdit ? (
          addingField === field ? (
            <div className="flex flex-wrap gap-2">
              <Input
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder={`Add ${label.toLowerCase()}`}
              />
              <Button size="sm" disabled={pending} onClick={() => addListItem(field)}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingField(null);
                  setAddValue("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setAddingField(field);
                setAddValue("");
              }}
            >
              Add {label.toLowerCase()}
            </Button>
          )
        ) : null}
      </div>
    );
  };

  if (!hasAny && !editable.canEdit) {
    return (
      <Surface>
        <PanelBody>
          <p className="text-muted-foreground text-body leading-relaxed">
            Nothing in your Professional Profile yet. Add a CV, LinkedIn PDF,
            portfolio website, or notes below, then generate a draft to review.
          </p>
        </PanelBody>
      </Surface>
    );
  }

  return (
    <Surface>
      <PanelHeader className="flex-col items-start gap-1">
        <p className="text-body font-medium">
          Approved knowledge
        </p>
        <p className="text-muted-foreground text-body-sm leading-relaxed">
          Quick fact edits on the approved profile. For bigger changes, use Edit
          profile above — matching toggles never delete this knowledge.
        </p>
        {sourceLabels && sourceLabels.length > 0 ? (
          <p className="text-muted-foreground text-body-sm">
            Built from: {sourceLabels.join(" · ")}
          </p>
        ) : null}
      </PanelHeader>
      <PanelBody className="space-y-8">
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        {message ? <InlineAlert variant="success">{message}</InlineAlert> : null}

        <div className="grid gap-6 sm:grid-cols-2">
          {renderScalar("currentRole", "Professional title", profile.currentRole)}
          {renderScalar("seniority", "Seniority level", profile.seniority)}
          {renderScalar(
            "yearsExperience",
            "Years of experience",
            profile.yearsExperience != null ? `${profile.yearsExperience}` : null,
          )}
          {renderChips("timeZones", "Location & timezone", profile.timeZones)}
        </div>

        {renderScalar(
          "professionalSummary",
          "Professional summary",
          profile.professionalSummary,
          true,
        )}
        {renderChips("strongestSkills", "Core skills", profile.strongestSkills)}
        {renderChips("tools", "Tools", profile.tools)}
        {renderChips("licenses", "Licences", profile.licenses)}
        {renderChips("industries", "Industries", profile.industries)}
        {renderChips(
          "domainExpertise",
          "Domain expertise",
          profile.domainExpertise ?? [],
        )}
        {renderChips("targetRoles", "Preferred roles", profile.targetRoles)}
        {renderChips(
          "preferredEmploymentTypes",
          "Preferred job types",
          profile.preferredEmploymentTypes,
        )}

        {(pay || editable.canEdit) && (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-muted-foreground text-body-sm font-medium">
                Salary or rate preferences
              </p>
              {editable.canEdit && pay ? (
                <FactActions
                  disabled={pending}
                  onRemove={() => removeScalar("compensation")}
                />
              ) : null}
            </div>
            {pay ? (
              <p className="text-body">{pay}</p>
            ) : (
              <p className="text-muted-foreground text-body-sm">
                Set pay preferences in the draft editor below.
              </p>
            )}
          </div>
        )}

        {renderChips("education", "Education", profile.education ?? [])}
        {renderChips(
          "certifications",
          "Certifications",
          profile.certifications ?? [],
        )}
        {renderChips("languages", "Languages", profile.languages)}
        {renderChips(
          "notableClients",
          "Notable clients",
          profile.notableClients ?? [],
        )}
        {renderChips("achievements", "Achievements", profile.achievements ?? [])}
        {renderScalar("workingStyle", "Working style", profile.workingStyle, true)}
        {renderChips(
          "strengthsAndDifferentiators",
          "Strengths & differentiators",
          profile.strengthsAndDifferentiators,
        )}

        {otherProjects.length > 0 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-body-sm font-medium">
              Work history
            </p>
            <ul className="space-y-3">
              {otherProjects.map((p) => {
                const key = `project:${p.title}`;
                return (
                  <li
                    key={key}
                    className="bg-subtle rounded-tile px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {p.role && p.organization
                            ? `${p.role} · ${p.organization}`
                            : p.title}
                        </p>
                        {(p.start || p.end) && (
                          <p className="text-muted-foreground mt-0.5 text-body-sm">
                            {[p.start, p.end].filter(Boolean).join(" – ")}
                            {p.location ? ` · ${p.location}` : ""}
                          </p>
                        )}
                      </div>
                      {editable.canEdit ? (
                        <FactActions
                          disabled={pending}
                          onEdit={() => {
                            setEditingKey(key);
                            setDraftValue(p.summary ?? "");
                          }}
                          onRemove={() =>
                            run("Project removed", () =>
                              removeProfileFactAction({
                                profileId: editable.profileId!,
                                field: "relevantProjects",
                                projectTitle: p.title,
                              }),
                            )
                          }
                        />
                      ) : null}
                    </div>
                    {editingKey === key ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run("Project updated", () =>
                              updateProfileFactAction({
                                profileId: editable.profileId!,
                                field: "relevantProjects",
                                projectTitle: p.title,
                                value: draftValue,
                              }),
                            )
                          }
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <>
                        {p.summary ? (
                          <p className="text-muted-foreground mt-1 text-body-sm">
                            {p.summary}
                          </p>
                        ) : null}
                        {p.outcomes.length ? (
                          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-body-sm">
                            {p.outcomes.slice(0, 4).map((o) => (
                              <li key={o}>{o}</li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                    <SourceBadges sources={p.sourcePointers} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {portfolioProjects.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground text-body-sm font-medium">
                Portfolio projects
              </p>
              {portfolioProjectsExcludedFromMatching ? (
                <Badge variant="secondary">
                  Excluded from matching
                </Badge>
              ) : (
                <Badge variant="outline">
                  Used for matching
                </Badge>
              )}
            </div>
            <ul className="space-y-3">
              {portfolioProjects.map((p) => (
                <li
                  key={p.title}
                  className={cn(
                    "border-border rounded-xl border px-4 py-3",
                    portfolioProjectsExcludedFromMatching && "opacity-80",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{p.title}</p>
                    {editable.canEdit ? (
                      <FactActions
                        disabled={pending}
                        onRemove={() =>
                          run("Project removed", () =>
                            removeProfileFactAction({
                              profileId: editable.profileId!,
                              field: "relevantProjects",
                              projectTitle: p.title,
                            }),
                          )
                        }
                      />
                    ) : null}
                  </div>
                  {p.summary ? (
                    <p className="text-muted-foreground mt-1 text-body-sm">
                      {p.summary}
                    </p>
                  ) : null}
                  <SourceBadges
                    sources={
                      p.sourcePointers.length
                        ? p.sourcePointers
                        : ["Portfolio website"]
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PanelBody>
    </Surface>
  );
}
