"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  approveProfileAction,
  createProfileDraftFromApprovedAction,
  deleteProfileSourceAction,
  extractProfileAction,
  setMatchingSourcesConfigAction,
  setProfileSourceMatchingEnabledAction,
  ingestCvAction,
  ingestGithubAction,
  ingestManualNotesAction,
  ingestPortfolioUrlAction,
  ingestTextSourceAction,
  saveProfileDraftAction,
} from "@/app/actions";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/file-dropzone";
import { InlineAlert } from "@/components/inline-alert";
import { PanelBody, Surface } from "@/components/page-shell";
import { StickyFormActions } from "@/components/sticky-form-actions";
import type { MatchingSourcesConfig } from "@/modules/profile/matching-sources-core";
import type { StructuredProfile } from "@/modules/profile/schemas";
import {
  COMPENSATION_CURRENCIES,
  EMPTY_STRUCTURED_PROFILE,
  formatCompensation,
  resolveCompensation,
  roleWithLevel,
  type CompensationExpectation,
} from "@/modules/profile/schemas";
import { cn } from "@/lib/utils";

type SourceView = {
  id: string;
  type: string;
  label: string | null;
  sourceUrl: string | null;
  ingestedAt: string;
  textLength: number;
  lastSyncedAt?: string | null;
  enabledForMatching?: boolean;
};

type ProfileView = {
  id: string;
  version: number;
  status: string;
  modelId: string | null;
  promptVersion: string | null;
  createdAt: string;
  approvedAt: string | null;
  profile: StructuredProfile;
  sourceIds: string[];
};

const SOURCE_LABELS: Record<string, string> = {
  cv: "CV",
  linkedin_text: "LinkedIn",
  portfolio_url: "Portfolio",
  manual: "About you",
  document: "Document",
  github: "GitHub",
};

/** Category switch that the per-source checkbox replaces. */
const SOURCE_MATCH_CATEGORY: Partial<Record<string, keyof MatchingSourcesConfig>> = {
  cv: "cv",
  linkedin_text: "linkedin",
  manual: "manual",
  github: "github",
};

type ReviewTab = "essentials" | "skills" | "preferences" | "advanced";

/** `?fix=` values from Market fit CTAs. */
export type ProfileFixTarget =
  | "sources"
  | "essentials"
  | "skills"
  | "preferences"
  | "evidence"
  | "advanced";

function reviewTabFromFix(fix: string | null): ReviewTab | null {
  if (
    fix === "essentials" ||
    fix === "skills" ||
    fix === "preferences" ||
    fix === "advanced"
  ) {
    return fix;
  }
  if (fix === "evidence") return "advanced";
  return null;
}

const REVIEW_TABS: Array<{
  id: ReviewTab;
  label: string;
  description: string;
}> = [
  {
    id: "essentials",
    label: "Essentials",
    description: "Who you are and what roles you’re targeting.",
  },
  {
    id: "skills",
    label: "Skills",
    description: "Strengths, industries, and tools used for matching.",
  },
  {
    id: "preferences",
    label: "Job prefs",
    description: "Pay, employment type, and roles to skip.",
  },
  {
    id: "advanced",
    label: "More",
    description: "Project details for deeper match context.",
  },
];

/** Section block inside a profile tab — AutoSend / Apollo card grouping. */
function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-subtle space-y-4 rounded-panel px-4 py-4 sm:px-5 sm:py-5">
      <header className="space-y-1">
        <h3 className="text-body font-medium text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-muted-foreground text-body-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(value: string[] | undefined): string {
  return (value ?? []).join("\n");
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-body font-medium sm:text-body-sm">
          {label}
        </Label>
        {hint ? (
          <p className="text-muted-foreground/80 text-body-sm leading-snug sm:text-body">
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function CompensationField({
  value,
  onChange,
  disabled,
}: {
  value: CompensationExpectation;
  onChange: (next: CompensationExpectation) => void;
  disabled?: boolean;
}) {
  const period =
    value.mode === "hourly" ? "/ hour" : value.mode === "monthly" ? "/ month" : "/ year";
  const summary = formatCompensation(value);

  function setAmount(
    key: "min" | "max",
    raw: string,
  ) {
    const trimmed = raw.trim().replace(/,/g, "");
    if (!trimmed) {
      onChange({ ...value, [key]: null });
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0) return;
    onChange({ ...value, [key]: n });
  }

  return (
    <Field
      label="Rate / salary"
      hint="Set a range, then choose per year, per month or per hour — and the currency."
      className="sm:col-span-2"
    >
      <div
        className={cn(
          "bg-subtle space-y-4 rounded-panel p-4 sm:p-5",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div
          className="bg-card grid grid-cols-3 gap-1 rounded-full p-1"
          role="group"
          aria-label="Pay type"
        >
          {(
            [
              { id: "salary", label: "Per year" },
              { id: "monthly", label: "Per month" },
              { id: "hourly", label: "Per hour" },
            ] as const
          ).map((opt) => {
            const active = value.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onChange({ ...value, mode: opt.id })}
                className={cn(
                  "h-9 rounded-full px-3 text-body-sm transition-colors duration-150 ease-standard",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:min-w-[12rem]">
            <span className="text-muted-foreground text-body-sm font-medium">
              Currency
            </span>
            <div
              className="bg-card flex flex-wrap gap-1 rounded-full p-1"
              role="group"
              aria-label="Currency"
            >
              {COMPENSATION_CURRENCIES.map((code) => {
                const active = value.currency === code;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => onChange({ ...value, currency: code })}
                    className={cn(
                      "h-9 min-w-[2.75rem] rounded-full px-3 text-body-sm tabular-nums transition-colors duration-150 ease-standard",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-body-sm font-medium">
                From
              </span>
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={value.min ?? ""}
                onChange={(e) => setAmount("min", e.target.value)}
                placeholder={value.mode === "hourly" ? "80" : "90000"}
              />
            </div>
            <span
              className="text-muted-foreground pb-3 text-body font-medium"
              aria-hidden
            >
              –
            </span>
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-body-sm font-medium">
                To
              </span>
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={value.max ?? ""}
                onChange={(e) => setAmount("max", e.target.value)}
                placeholder={value.mode === "hourly" ? "100" : "110000"}
              />
            </div>
          </div>

          <span className="text-muted-foreground pb-3 text-body font-medium sm:min-w-[4.5rem]">
            {period}
          </span>
        </div>

        {summary ? (
          <p className="text-muted-foreground text-body">
            Saved as{" "}
            <span className="text-foreground font-medium">{summary}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-body">
            Optional — leave blank if you prefer not to set a range yet.
          </p>
        )}
      </div>
    </Field>
  );
}

const EMPLOYMENT_TYPE_OPTIONS = [
  "Full-time",
  "Contract",
  "Freelance",
  "Part-time",
] as const;

function EmploymentTypeField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const selected = linesToList(value);

  function toggle(option: string) {
    const exists = selected.some(
      (item) => item.toLowerCase() === option.toLowerCase(),
    );
    const next = exists
      ? selected.filter((item) => item.toLowerCase() !== option.toLowerCase())
      : [...selected, option];
    onChange(next.join("\n"));
  }

  return (
    <Field
      label="Employment type"
      hint="Select all that fit."
      className="sm:col-span-2"
    >
      <div className="flex flex-wrap gap-2">
        {EMPLOYMENT_TYPE_OPTIONS.map((option) => {
          const active = selected.some(
            (item) => item.toLowerCase() === option.toLowerCase(),
          );
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => toggle(option)}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-body-sm font-medium transition-colors",
                active
                  ? "border-brand bg-brand/15 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-foreground",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function ChipListField({
  label,
  value,
  onChange,
  disabled,
  placeholder = "Type and press Enter",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const items = linesToList(value);

  function commit(raw: string) {
    const next = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...items];
    for (const item of next) {
      if (!merged.some((x) => x.toLowerCase() === item.toLowerCase())) {
        merged.push(item);
      }
    }
    onChange(merged.join("\n"));
    setDraft("");
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index).join("\n"));
  }

  return (
    <Field label={label}>
      <div
        className={cn(
          "border-input bg-background focus-within:border-ring focus-within:ring-ring/40 flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-3",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="bg-card text-foreground border-border-strong inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-body-sm"
          >
            <span className="truncate">{item}</span>
            {!disabled ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => remove(i)}
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          placeholder={items.length === 0 ? placeholder : "Add…"}
          className="placeholder:text-muted-foreground min-w-[120px] flex-1 bg-transparent py-0.5 text-body outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && items.length > 0) {
              remove(items.length - 1);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
        />
      </div>
    </Field>
  );
}

export function ProfileWorkspace({
  sources,
  matchingConfig,
  draft,
  approved,
  initialFix = null,
  children,
}: {
  sources: SourceView[];
  matchingConfig: MatchingSourcesConfig;
  draft: ProfileView | null;
  approved: ProfileView | null;
  /** Market fit deep-link (`?fix=`). */
  initialFix?: ProfileFixTarget | null;
  /** Extra setup sections (e.g. Matching) — rendered above sticky approve. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fileKind, setFileKind] = useState<"cv" | "linkedin_text">("cv");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [githubInput, setGithubInput] = useState("");
  const [aboutYou, setAboutYou] = useState("");
  const [linkedinPaste, setLinkedinPaste] = useState("");
  const [showLinkedinPaste, setShowLinkedinPaste] = useState(false);
  // `?fix=` deep links from "Worth improving" open the right place on first render.
  const [reviewTab, setReviewTab] = useState<ReviewTab>(
    () => reviewTabFromFix(initialFix) ?? "essentials",
  );
  const [sourcesOpen, setSourcesOpen] = useState(initialFix === "sources");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [matchingOverride, setMatchingOverride] = useState<Record<string, boolean>>({});
  const matchKey = `${sources
    .map((s) => `${s.id}:${s.enabledForMatching ? 1 : 0}`)
    .join("|")}|${JSON.stringify(matchingConfig)}`;
  const [seenMatchKey, setSeenMatchKey] = useState(matchKey);
  if (matchKey !== seenMatchKey) {
    setSeenMatchKey(matchKey);
    setMatchingOverride({});
  }

  function sourceUsedForMatching(source: SourceView) {
    if (source.id in matchingOverride) return matchingOverride[source.id]!;
    const category = SOURCE_MATCH_CATEGORY[source.type];
    const categoryOn = category ? matchingConfig[category] : true;
    return source.enabledForMatching !== false && categoryOn;
  }

  function toggleSourceMatching(source: SourceView, enabled: boolean) {
    const category = SOURCE_MATCH_CATEGORY[source.type];
    const othersOn = sources.some((other) => {
      if (other.id === source.id || other.type !== source.type) return false;
      if (other.id in matchingOverride) return matchingOverride[other.id];
      return other.enabledForMatching !== false;
    });
    setMatchingOverride((prev) => ({ ...prev, [source.id]: enabled }));
    setError(null);
    startTransition(async () => {
      const result = await setProfileSourceMatchingEnabledAction(source.id, enabled);
      if (!result.ok) {
        setMatchingOverride((prev) => {
          const next = { ...prev };
          delete next[source.id];
          return next;
        });
        setError(result.error ?? "Could not update source");
        return;
      }
      if (category && (enabled || !othersOn)) {
        const categoryResult = await setMatchingSourcesConfigAction({
          [category]: enabled,
        });
        if (!categoryResult.ok) {
          setError(categoryResult.error ?? "Could not update matching");
          return;
        }
      }
      router.refresh();
    });
  }

  const active = draft ?? approved;
  const canEdit = Boolean(draft) && !pending;

  useEffect(() => {
    if (!initialFix) return;
    requestAnimationFrame(() => {
      document
        .getElementById("profile-workspace")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [initialFix]);

  const [editingId, setEditingId] = useState<string | null>(draft?.id ?? null);
  const editable = useMemo(() => {
    return draft?.profile ?? approved?.profile ?? EMPTY_STRUCTURED_PROFILE;
  }, [draft, approved]);

  const [currentRole, setCurrentRole] = useState(editable.currentRole ?? "");
  const [seniority, setSeniority] = useState(editable.seniority ?? "");
  const [yearsExperience, setYearsExperience] = useState(
    editable.yearsExperience != null ? String(editable.yearsExperience) : "",
  );
  const [strongestSkills, setStrongestSkills] = useState(
    listToLines(editable.strongestSkills),
  );
  const [industries, setIndustries] = useState(listToLines(editable.industries));
  const [productTypes, setProductTypes] = useState(
    listToLines(editable.productTypes),
  );
  const [tools, setTools] = useState(listToLines(editable.tools));
  const [licenses, setLicenses] = useState(listToLines(editable.licenses));
  const [leadershipExperience, setLeadershipExperience] = useState(
    editable.leadershipExperience ?? "",
  );
  const [preferredEmploymentTypes, setPreferredEmploymentTypes] = useState(
    listToLines(editable.preferredEmploymentTypes),
  );
  const [preferredLocations, setPreferredLocations] = useState(
    listToLines(editable.preferredLocations),
  );
  const [timeZones, setTimeZones] = useState(listToLines(editable.timeZones));
  const [compensation, setCompensation] = useState<CompensationExpectation>(
    () => resolveCompensation(editable),
  );
  const [availability, setAvailability] = useState(editable.availability ?? "");
  const [strengthsAndDifferentiators, setStrengthsAndDifferentiators] =
    useState(listToLines(editable.strengthsAndDifferentiators));
  const [targetRoles, setTargetRoles] = useState(
    listToLines(editable.targetRoles),
  );
  const [rolesBelowLevel, setRolesBelowLevel] = useState(
    listToLines(editable.rolesBelowLevel),
  );
  const [rolesAboveLevel, setRolesAboveLevel] = useState(
    listToLines(editable.rolesAboveLevel),
  );
  const [languages, setLanguages] = useState(listToLines(editable.languages));
  const [projectsJson, setProjectsJson] = useState(
    JSON.stringify(editable.relevantProjects ?? [], null, 2),
  );

  const formKey = `${draft?.id ?? "none"}-${draft?.version ?? 0}-${approved?.id ?? "none"}`;
  const [lastKey, setLastKey] = useState(formKey);
  if (formKey !== lastKey) {
    setLastKey(formKey);
    setEditingId(draft?.id ?? null);
    const p = draft?.profile ?? approved?.profile ?? EMPTY_STRUCTURED_PROFILE;
    setCurrentRole(p.currentRole ?? "");
    setSeniority(p.seniority ?? "");
    setYearsExperience(
      p.yearsExperience != null ? String(p.yearsExperience) : "",
    );
    setStrongestSkills(listToLines(p.strongestSkills));
    setIndustries(listToLines(p.industries));
    setProductTypes(listToLines(p.productTypes));
    setTools(listToLines(p.tools));
    setLicenses(listToLines(p.licenses));
    setLeadershipExperience(p.leadershipExperience ?? "");
    setPreferredEmploymentTypes(listToLines(p.preferredEmploymentTypes));
    setPreferredLocations(listToLines(p.preferredLocations));
    setTimeZones(listToLines(p.timeZones));
    setCompensation(resolveCompensation(p));
    setAvailability(p.availability ?? "");
    setStrengthsAndDifferentiators(listToLines(p.strengthsAndDifferentiators));
    setTargetRoles(listToLines(p.targetRoles));
    setRolesBelowLevel(listToLines(p.rolesBelowLevel));
    setRolesAboveLevel(listToLines(p.rolesAboveLevel));
    setLanguages(listToLines(p.languages));
    setProjectsJson(JSON.stringify(p.relevantProjects ?? [], null, 2));
  }

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setMessage(label);
      router.refresh();
    });
  }

  function buildProfile(): StructuredProfile {
    let relevantProjects = editable.relevantProjects ?? [];
    try {
      relevantProjects = JSON.parse(projectsJson || "[]");
    } catch {
      throw new Error("Projects JSON is invalid");
    }
    const years = yearsExperience.trim() ? Number(yearsExperience) : null;
    if (yearsExperience.trim() && Number.isNaN(years)) {
      throw new Error("Years experience must be a number");
    }
    return {
      ...editable,
      currentRole: currentRole.trim() || undefined,
      seniority: seniority.trim() || undefined,
      yearsExperience: years,
      strongestSkills: linesToList(strongestSkills),
      industries: linesToList(industries),
      productTypes: linesToList(productTypes),
      relevantProjects,
      tools: linesToList(tools),
      licenses: linesToList(licenses),
      leadershipExperience: leadershipExperience.trim() || undefined,
      preferredEmploymentTypes: linesToList(preferredEmploymentTypes),
      preferredLocations: linesToList(preferredLocations),
      timeZones: linesToList(timeZones),
      compensation:
        compensation.min != null || compensation.max != null
          ? compensation
          : undefined,
      salaryOrRateExpectations: formatCompensation(compensation),
      availability: availability.trim() || undefined,
      strengthsAndDifferentiators: linesToList(strengthsAndDifferentiators),
      targetRoles: linesToList(targetRoles),
      rolesBelowLevel: linesToList(rolesBelowLevel),
      rolesAboveLevel: linesToList(rolesAboveLevel),
      languages: linesToList(languages),
      groundingNotes: editable.groundingNotes ?? [],
      fieldSources: editable.fieldSources ?? {},
      education: editable.education ?? [],
      certifications: editable.certifications ?? [],
      notableClients: editable.notableClients ?? [],
      achievements: editable.achievements ?? [],
      domainExpertise: editable.domainExpertise ?? [],
      professionalSummary: editable.professionalSummary,
      workingStyle: editable.workingStyle,
    };
  }

  function ingestFile(file: File, kind: "cv" | "linkedin_text") {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", kind);
    run(
      kind === "cv" ? "CV added" : "LinkedIn PDF added",
      () => ingestCvAction(formData),
    );
  }

  function saveDraft() {
    if (!draft) return;
    try {
      const profile = buildProfile();
      run("Saved", () =>
        saveProfileDraftAction(editingId ?? draft.id, profile),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function approveDraft() {
    if (!draft) return;
    try {
      const profile = buildProfile();
      const id = editingId ?? draft.id;
      startTransition(async () => {
        setError(null);
        const saved = await saveProfileDraftAction(id, profile);
        if (!saved.ok) {
          setError(saved.error);
          return;
        }
        const approvedResult = await approveProfileAction(id);
        if (!approvedResult.ok) {
          setError(approvedResult.error);
          return;
        }
        setMessage("Approved for job matching");
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const tags = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string,
  ) => (
    <ChipListField
      label={label}
      value={value}
      onChange={onChange}
      disabled={!canEdit}
      placeholder={placeholder}
    />
  );

  const essentialsFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Role"
        description="How you present yourself in matching and outreach."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Current role">
            <Input
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Nurse, Truck Driver, Accountant"
            />
          </Field>
          <Field label="Seniority">
            <Input
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Senior"
            />
          </Field>
          <Field label="Years experience">
            <Input
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              disabled={!canEdit}
              inputMode="numeric"
            />
          </Field>
          <Field label="Availability">
            <Input
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </ProfileSection>
      <ProfileSection
        title="Targets"
        description="Roles and places you want Optra to prioritize."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Target roles", targetRoles, setTargetRoles, "Role + Enter")}
          {tags(
            "Locations",
            preferredLocations,
            setPreferredLocations,
            "City / Remote + Enter",
          )}
        </div>
      </ProfileSection>
    </div>
  );

  const skillsFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Strengths"
        description="What you’re strongest at — used heavily in scoring."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Strongest skills", strongestSkills, setStrongestSkills)}
          {tags(
            "Differentiators",
            strengthsAndDifferentiators,
            setStrengthsAndDifferentiators,
          )}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Domain"
        description="Industries and product contexts you’ve worked in."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Industries", industries, setIndustries)}
          {tags("Product types", productTypes, setProductTypes)}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Tools and licences"
        description="Software, equipment, driving licence categories and professional licences."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Tools", tools, setTools)}
          {tags("Licences", licenses, setLicenses)}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Leadership"
        description="Optional. Team size, management, or mentoring — in your words."
      >
        <Textarea
          value={leadershipExperience}
          onChange={(e) => setLeadershipExperience(e.target.value)}
          disabled={!canEdit}
          rows={3}
          placeholder="e.g. Led a shift of 6 nurses, or a team of 4 developers"
          className="min-h-[5.5rem] text-body-sm"
        />
      </ProfileSection>
    </div>
  );

  const preferencesFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Compensation & type"
        description="Hard filters for pay and employment style."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CompensationField
            value={compensation}
            onChange={setCompensation}
            disabled={!canEdit}
          />
          <EmploymentTypeField
            value={preferredEmploymentTypes}
            onChange={setPreferredEmploymentTypes}
            disabled={!canEdit}
          />
        </div>
      </ProfileSection>
      <ProfileSection
        title="Logistics"
        description="Where and how you prefer to work."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Time zones", timeZones, setTimeZones)}
          {tags("Languages", languages, setLanguages)}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Role filters"
        description="Titles that are clearly too junior or too senior for you."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags(
            "Roles that are too junior",
            rolesBelowLevel,
            setRolesBelowLevel,
          )}
          {tags(
            "Roles that are too senior",
            rolesAboveLevel,
            setRolesAboveLevel,
          )}
        </div>
      </ProfileSection>
    </div>
  );

  const advancedFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Projects"
        description="Structured project data (JSON). Used for deeper portfolio-aware matching when enabled."
      >
        <Field label="Projects JSON">
          <Textarea
            value={projectsJson}
            onChange={(e) => setProjectsJson(e.target.value)}
            disabled={!canEdit}
            rows={10}
            className="font-mono text-body"
          />
        </Field>
      </ProfileSection>
    </div>
  );

  function renderReviewFields() {
    switch (reviewTab) {
      case "essentials":
        return essentialsFields;
      case "skills":
        return skillsFields;
      case "preferences":
        return preferencesFields;
      case "advanced":
        return advancedFields;
    }
  }

  const activeTabMeta =
    REVIEW_TABS.find((t) => t.id === reviewTab) ?? REVIEW_TABS[0]!;

  function renderTabChrome(actions?: React.ReactNode) {
    return (
      <div className="border-border space-y-3 border-b px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Profile sections"
            className="bg-subtle flex flex-wrap gap-0.5 rounded-full p-1"
          >
            {REVIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={reviewTab === tab.id ? "page" : undefined}
                onClick={() => setReviewTab(tab.id)}
                className={cn(
                  "h-9 rounded-full px-4 text-body-sm font-medium transition-colors duration-150 ease-standard",
                  reviewTab === tab.id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {actions}
        </div>
        <p className="text-muted-foreground text-body-sm leading-relaxed">
          {activeTabMeta.description}
        </p>
      </div>
    );
  }

  const sourceList = sources.length > 0 ? (
    <ul className="divide-border divide-y">
      {sources.map((s) => (
        <li key={s.id} className="space-y-2 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body font-medium">
                {SOURCE_LABELS[s.type] ?? s.type}
                {s.label ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {s.label}
                  </span>
                ) : null}
              </p>
              <p className="text-muted-foreground text-body-sm wrap-anywhere">
                {s.textLength.toLocaleString()} chars
                {s.sourceUrl ? ` · ${s.sourceUrl}` : ""}
                {s.lastSyncedAt
                  ? ` · synced ${new Date(s.lastSyncedAt).toLocaleDateString()}`
                  : ""}
              </p>
              {confirmDeleteId === s.id ? null : (
                <label className="text-muted-foreground mt-2 flex items-center gap-2 text-body-sm">
                  <input
                    type="checkbox"
                    className="border-input size-4 rounded"
                    checked={sourceUsedForMatching(s)}
                    disabled={pending}
                    onChange={(e) => toggleSourceMatching(s, e.target.checked)}
                  />
                  Use for matching
                </label>
              )}
            </div>
            {confirmDeleteId === s.id ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmDeleteId(s.id)}
              >
                Remove
              </Button>
            )}
          </div>
          {confirmDeleteId === s.id ? (
            <div className="bg-destructive-wash space-y-2 rounded-tile px-4 py-3">
              <p className="text-destructive text-body-sm leading-relaxed">
                Remove this connected source? Extracted Professional Profile
                facts stay until you edit or regenerate a draft. This does not
                change matching toggles for other sources.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run("Source removed", async () => {
                      const result = await deleteProfileSourceAction(s.id, {
                        confirmed: true,
                      });
                      setConfirmDeleteId(null);
                      return result;
                    })
                  }
                >
                  Confirm remove
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  ) : null;

  const moreSourcesPanel = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-body">Files</Label>
          <div className="flex gap-1">
            {(
              [
                ["cv", "CV"],
                ["linkedin_text", "LinkedIn PDF"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={fileKind === value ? "default" : "outline"}
                disabled={pending}
                onClick={() => setFileKind(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <FileDropzone
          disabled={pending}
          label={
            fileKind === "cv"
              ? "Drop your CV here, or click to browse"
              : "Drop LinkedIn PDF here, or click to browse"
          }
          hint={
            fileKind === "cv"
              ? "PDF, TXT, or MD"
              : "LinkedIn → More → Save to PDF"
          }
          onFile={(file) => ingestFile(file, fileKind)}
        />
        {fileKind === "linkedin_text" ? (
          <div className="space-y-2">
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-body-sm leading-relaxed">
              <li>Open your LinkedIn profile</li>
              <li>
                Choose <span className="text-foreground font-medium">Resources</span>{" "}
                or <span className="text-foreground font-medium">More</span>
              </li>
              <li>
                Select{" "}
                <span className="text-foreground font-medium">Save to PDF</span>
              </li>
              <li>Upload the PDF here (Optra does not connect to LinkedIn)</li>
            </ol>
            <p className="text-muted-foreground text-body-sm">
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setShowLinkedinPaste((v) => !v)}
              >
                {showLinkedinPaste ? "Hide paste" : "Or paste text instead"}
              </button>
            </p>
          </div>
        ) : null}
        {showLinkedinPaste && fileKind === "linkedin_text" ? (
          <div className="space-y-2">
            <Textarea
              value={linkedinPaste}
              onChange={(e) => setLinkedinPaste(e.target.value)}
              rows={3}
              placeholder="Paste LinkedIn About / Experience…"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !linkedinPaste.trim()}
              onClick={() =>
                run("LinkedIn text added", async () => {
                  const result = await ingestTextSourceAction({
                    type: "linkedin_text",
                    text: linkedinPaste,
                    label: "LinkedIn paste",
                  });
                  if (!result.ok) return result;
                  setLinkedinPaste("");
                  setShowLinkedinPaste(false);
                  return { ok: true as const };
                })
              }
            >
              Save text
            </Button>
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="portfolio-url" className="text-body">
          Website
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="portfolio-url"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://…"
            className="min-w-[180px] flex-1"
            disabled={pending}
          />
          <Button
            type="button"
            disabled={pending || !portfolioUrl.trim()}
            onClick={() =>
              run("Website added", async () => {
                const result = await ingestPortfolioUrlAction(
                  portfolioUrl.trim(),
                );
                if (result.ok) setPortfolioUrl("");
                return result;
              })
            }
          >
            Fetch
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="github-profile" className="text-body">
          GitHub
        </Label>
        <p className="text-muted-foreground text-body-sm leading-snug">
          We pull public repos, descriptions, and README excerpts — then draft
          projects for your profile.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            id="github-profile"
            value={githubInput}
            onChange={(e) => setGithubInput(e.target.value)}
            placeholder="username or https://github.com/you"
            className="min-w-[180px] flex-1"
            disabled={pending}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            type="button"
            disabled={pending || !githubInput.trim()}
            onClick={() =>
              run("GitHub added", async () => {
                const result = await ingestGithubAction(githubInput.trim());
                if (!result.ok) return result;
                setGithubInput("");
                return { ok: true as const };
              })
            }
          >
            Import
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="about-you" className="text-body">
          About you
        </Label>
        <Textarea
          id="about-you"
          value={aboutYou}
          onChange={(e) => setAboutYou(e.target.value)}
          rows={4}
          disabled={pending}
          placeholder="Target roles, remote/EU, rate, what to skip…"
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || !aboutYou.trim()}
          onClick={() =>
            run("About you saved", async () => {
              const result = await ingestManualNotesAction(aboutYou);
              if (result.ok) setAboutYou("");
              return result;
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );

  const pageSourcesOpen = sourcesOpen || !active;

  const editButton = (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        run("Ready to edit", () => createProfileDraftFromApprovedAction())
      }
    >
      {pending ? "Opening…" : "Edit"}
    </Button>
  );

  return (
    <div id="profile-workspace" className="space-y-6 scroll-mt-20">
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {message ? <InlineAlert variant="info">{message}</InlineAlert> : null}

      {!active ? (
        <Surface>
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center sm:px-8 sm:py-14">
            <p className="text-h5 font-medium">No profile yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-body leading-relaxed">
              {sources.length === 0
                ? "Add your CV below. Optra reads it and builds your profile."
                : "Build your profile from the sources you added."}
            </p>
            {sources.length > 0 ? (
              <Button
                type="button"
                size="lg"
                className="min-w-[12rem]"
                disabled={pending}
                onClick={() => run("Profile drafted", () => extractProfileAction())}
              >
                {pending ? "Building…" : "Build my profile"}
              </Button>
            ) : null}
          </div>
        </Surface>
      ) : draft ? (
        <Surface>
          {renderTabChrome()}
          <PanelBody className="space-y-6">{renderReviewFields()}</PanelBody>
        </Surface>
      ) : (
        <ProfileSummaryCard profile={active.profile} action={editButton} />
      )}

      <Accordion
        value={pageSourcesOpen ? ["sources"] : []}
        onValueChange={(value) => setSourcesOpen(value.includes("sources"))}
      >
        <AccordionItem value="sources">
          <AccordionTrigger>
            <span className="text-foreground block text-body font-medium">Sources</span>
            <span className="text-muted-foreground block text-body-sm">
              {sources.length === 0
                ? "Nothing added yet"
                : pageSourcesOpen
                  ? `${sources.length} connected`
                  : sources.map((s) => SOURCE_LABELS[s.type] ?? s.type).join(" · ")}
            </span>
          </AccordionTrigger>
          <AccordionPanel className="text-foreground space-y-6 text-body-sm">
            {sourceList}
            {sources.length > 0 && active ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run("New draft ready to review", () => extractProfileAction())}
                >
                  {pending ? "Reading…" : "Rebuild profile from sources"}
                </Button>
                <p className="text-muted-foreground text-body-sm">
                  Use after adding or updating a source.
                </p>
              </div>
            ) : null}
            <Separator />
            {moreSourcesPanel}
            {children ? (
              <>
                <Separator />
                {children}
              </>
            ) : null}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      {draft ? (
        <StickyFormActions message="Matching keeps using your approved profile until you approve this one.">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={saveDraft}
          >
            Save draft
          </Button>
          <Button type="button" size="lg" disabled={pending} onClick={approveDraft}>
            Approve profile
          </Button>
        </StickyFormActions>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6 sm:px-6">
      <dt className="text-muted-foreground w-36 shrink-0 text-body-sm">{label}</dt>
      <dd className="min-w-0 flex-1 text-body leading-relaxed text-foreground">
        {children}
      </dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="bg-subtle rounded-full px-3 py-1 text-body-sm">
          {item}
        </span>
      ))}
    </div>
  );
}

/** Read-only view of the approved profile — editing is one click away. */
function ProfileSummaryCard({
  profile,
  action,
}: {
  profile: StructuredProfile;
  action: React.ReactNode;
}) {
  const headline = roleWithLevel(
    profile.seniority,
    profile.targetRoles[0] ?? profile.currentRole,
  );
  const projects = profile.relevantProjects.slice(0, 6);
  const wants = [
    profile.preferredEmploymentTypes.join(", "),
    profile.preferredLocations.join(", "),
    formatCompensation(profile.compensation) ?? profile.salaryOrRateExpectations,
    profile.availability,
  ].filter((v): v is string => Boolean(v?.trim()));
  const domains = [...profile.industries, ...profile.productTypes].slice(0, 8);

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="text-h5 font-medium text-foreground">
            {headline || "Your profile"}
          </p>
          {profile.yearsExperience ? (
            <p className="text-muted-foreground mt-0.5 text-body-sm">
              {profile.yearsExperience} years of experience
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <dl className="border-border divide-border divide-y border-t">
        {profile.professionalSummary ? (
          <SummaryRow label="Summary">{profile.professionalSummary}</SummaryRow>
        ) : null}
        {profile.strongestSkills.length ? (
          <SummaryRow label="Skills">
            <Chips items={profile.strongestSkills.slice(0, 12)} />
          </SummaryRow>
        ) : null}
        {projects.length ? (
          <SummaryRow label="Work & projects">
            <ul className="space-y-1.5">
              {projects.map((project) => (
                <li key={project.title}>
                  <span className="font-medium">{project.title}</span>
                  {project.organization || project.role ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {[project.role, project.organization].filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </SummaryRow>
        ) : null}
        {domains.length ? (
          <SummaryRow label="Industries">
            <Chips items={domains} />
          </SummaryRow>
        ) : null}
        {wants.length ? <SummaryRow label="Looking for">{wants.join(" · ")}</SummaryRow> : null}
        {profile.languages.length ? (
          <SummaryRow label="Languages">{profile.languages.join(", ")}</SummaryRow>
        ) : null}
      </dl>
    </Surface>
  );
}
