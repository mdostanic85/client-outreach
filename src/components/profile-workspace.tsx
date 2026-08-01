"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, FileText, Link2, X } from "lucide-react";
import {
  approveProfileAction,
  deleteProfileSourceAction,
  extractProfileAction,
  ingestCvAction,
  ingestManualNotesAction,
  ingestPortfolioUrlAction,
  ingestTextSourceAction,
  saveProfileDraftAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/file-dropzone";
import {
  PanelBody,
  PanelHeader,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import type { StructuredProfile } from "@/modules/profile/schemas";
import { EMPTY_STRUCTURED_PROFILE } from "@/modules/profile/schemas";
import { cn } from "@/lib/utils";

type SourceView = {
  id: string;
  type: string;
  label: string | null;
  sourceUrl: string | null;
  ingestedAt: string;
  textLength: number;
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
};

type ReviewTab = "essentials" | "skills" | "preferences" | "advanced";

const REVIEW_TABS: Array<{ id: ReviewTab; label: string }> = [
  { id: "essentials", label: "Essentials" },
  { id: "skills", label: "Skills" },
  { id: "preferences", label: "Prefs" },
  { id: "advanced", label: "More" },
];

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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-[13px] font-medium">
        {label}
      </Label>
      {children}
    </div>
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
            className="bg-secondary text-secondary-foreground inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium"
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
          className="placeholder:text-muted-foreground min-w-[120px] flex-1 bg-transparent py-0.5 text-[13px] outline-none"
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

function ListField({
  label,
  value,
  onChange,
  disabled,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        className="min-h-[72px]"
        placeholder="One per line"
      />
    </Field>
  );
}

export function ProfileWorkspace({
  sources,
  draft,
  approved,
  variant = "page",
}: {
  sources: SourceView[];
  draft: ProfileView | null;
  approved: ProfileView | null;
  /** Compact phased UX for onboarding (Mobbin: Remote/Wellfound → Aboard tabs). */
  variant?: "page" | "onboarding";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fileKind, setFileKind] = useState<"cv" | "linkedin_text">("cv");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [aboutYou, setAboutYou] = useState("");
  const [linkedinPaste, setLinkedinPaste] = useState("");
  const [showLinkedinPaste, setShowLinkedinPaste] = useState(false);
  const [showMoreSources, setShowMoreSources] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<"sources" | "review" | null>(
    null,
  );
  const [reviewTab, setReviewTab] = useState<ReviewTab>("essentials");

  const active = draft ?? approved;
  const canEdit = Boolean(draft) && !pending;
  const isOnboarding = variant === "onboarding";
  const phase =
    phaseOverride ?? (active ? "review" : "sources");

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
  const [designTools, setDesignTools] = useState(
    listToLines(editable.designTools),
  );
  const [technicalTools, setTechnicalTools] = useState(
    listToLines(editable.technicalTools),
  );
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
  const [salaryOrRateExpectations, setSalaryOrRateExpectations] = useState(
    editable.salaryOrRateExpectations ?? "",
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
    setDesignTools(listToLines(p.designTools));
    setTechnicalTools(listToLines(p.technicalTools));
    setLeadershipExperience(p.leadershipExperience ?? "");
    setPreferredEmploymentTypes(listToLines(p.preferredEmploymentTypes));
    setPreferredLocations(listToLines(p.preferredLocations));
    setTimeZones(listToLines(p.timeZones));
    setSalaryOrRateExpectations(p.salaryOrRateExpectations ?? "");
    setAvailability(p.availability ?? "");
    setStrengthsAndDifferentiators(listToLines(p.strengthsAndDifferentiators));
    setTargetRoles(listToLines(p.targetRoles));
    setRolesBelowLevel(listToLines(p.rolesBelowLevel));
    setRolesAboveLevel(listToLines(p.rolesAboveLevel));
    setLanguages(listToLines(p.languages));
    setProjectsJson(JSON.stringify(p.relevantProjects ?? [], null, 2));
    if (draft && phaseOverride === "sources") {
      setPhaseOverride(null);
      setReviewTab("essentials");
    }
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
      currentRole: currentRole.trim() || undefined,
      seniority: seniority.trim() || undefined,
      yearsExperience: years,
      strongestSkills: linesToList(strongestSkills),
      industries: linesToList(industries),
      productTypes: linesToList(productTypes),
      relevantProjects,
      designTools: linesToList(designTools),
      technicalTools: linesToList(technicalTools),
      leadershipExperience: leadershipExperience.trim() || undefined,
      preferredEmploymentTypes: linesToList(preferredEmploymentTypes),
      preferredLocations: linesToList(preferredLocations),
      timeZones: linesToList(timeZones),
      salaryOrRateExpectations: salaryOrRateExpectations.trim() || undefined,
      availability: availability.trim() || undefined,
      strengthsAndDifferentiators: linesToList(strengthsAndDifferentiators),
      targetRoles: linesToList(targetRoles),
      rolesBelowLevel: linesToList(rolesBelowLevel),
      rolesAboveLevel: linesToList(rolesAboveLevel),
      languages: linesToList(languages),
      groundingNotes: editable.groundingNotes ?? [],
    };
  }

  function ingestFile(file: File, kind: "cv" | "linkedin_text") {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", kind);
    run(
      kind === "cv" ? "CV added" : "LinkedIn PDF added",
      async () => {
        const ingested = await ingestCvAction(formData);
        if (!ingested.ok) return ingested;
        if (isOnboarding) {
          const extracted = await extractProfileAction();
          if (!extracted.ok) return extracted;
          setPhaseOverride(null);
          setReviewTab("essentials");
          return { ok: true as const };
        }
        return ingested;
      },
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
  ) =>
    isOnboarding ? (
      <ChipListField
        label={label}
        value={value}
        onChange={onChange}
        disabled={!canEdit}
        placeholder={placeholder}
      />
    ) : (
      <ListField
        label={label}
        value={value}
        onChange={onChange}
        disabled={!canEdit}
      />
    );

  const essentialsFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Current role">
        <Input
          value={currentRole}
          onChange={(e) => setCurrentRole(e.target.value)}
          disabled={!canEdit}
          placeholder="e.g. Senior Product Designer"
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
      {tags("Target roles", targetRoles, setTargetRoles, "Role + Enter")}
      {tags(
        "Locations",
        preferredLocations,
        setPreferredLocations,
        "City / Remote + Enter",
      )}
    </div>
  );

  const skillsFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      {tags("Strongest skills", strongestSkills, setStrongestSkills)}
      {tags(
        "Strengths",
        strengthsAndDifferentiators,
        setStrengthsAndDifferentiators,
      )}
      {tags("Industries", industries, setIndustries)}
      {tags("Product types", productTypes, setProductTypes)}
      {tags("Design tools", designTools, setDesignTools)}
      {tags("Technical tools", technicalTools, setTechnicalTools)}
    </div>
  );

  const preferencesFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Rate / salary">
        <Input
          value={salaryOrRateExpectations}
          onChange={(e) => setSalaryOrRateExpectations(e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Leadership">
        <Input
          value={leadershipExperience}
          onChange={(e) => setLeadershipExperience(e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      {tags(
        "Employment types",
        preferredEmploymentTypes,
        setPreferredEmploymentTypes,
      )}
      {tags("Time zones", timeZones, setTimeZones)}
      {tags("Languages", languages, setLanguages)}
      {tags("Roles that are too junior", rolesBelowLevel, setRolesBelowLevel)}
      {tags("Roles that are too senior", rolesAboveLevel, setRolesAboveLevel)}
    </div>
  );

  const advancedFields = (
    <Field label="Projects (advanced JSON)">
      <Textarea
        value={projectsJson}
        onChange={(e) => setProjectsJson(e.target.value)}
        disabled={!canEdit}
        rows={isOnboarding ? 6 : 8}
        className="font-mono text-[13px]"
      />
    </Field>
  );

  function renderReviewFields() {
    if (!isOnboarding) {
      return (
        <div className="space-y-5">
          {essentialsFields}
          {skillsFields}
          {preferencesFields}
          {advancedFields}
        </div>
      );
    }
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

  const sourceList = sources.length > 0 ? (
    <ul className="divide-border divide-y">
      {sources.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">
              {SOURCE_LABELS[s.type] ?? s.type}
              {s.label ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {s.label}
                </span>
              ) : null}
            </p>
            <p className="text-muted-foreground text-[11px]">
              {s.textLength.toLocaleString()} chars
              {s.sourceUrl ? ` · ${s.sourceUrl}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run("Removed", () => deleteProfileSourceAction(s.id))}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  ) : null;

  const moreSourcesPanel = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-[13px]">Files</Label>
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
          <p className="text-muted-foreground text-[12px]">
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => setShowLinkedinPaste((v) => !v)}
            >
              {showLinkedinPaste ? "Hide paste" : "Or paste text instead"}
            </button>
          </p>
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
                  if (isOnboarding) {
                    const extracted = await extractProfileAction();
                    if (!extracted.ok) return extracted;
                    setPhaseOverride(null);
                    setReviewTab("essentials");
                  }
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
        <Label htmlFor="portfolio-url" className="text-[13px]">
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
        <Label htmlFor="about-you" className="text-[13px]">
          About you
        </Label>
        <Textarea
          id="about-you"
          value={aboutYou}
          onChange={(e) => setAboutYou(e.target.value)}
          rows={isOnboarding ? 2 : 4}
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

  if (isOnboarding && phase === "sources") {
    return (
      <div className="space-y-4">
        {error ? <p className="text-destructive text-[13px]">{error}</p> : null}
        {message ? (
          <p className="text-muted-foreground text-[13px]">{message}</p>
        ) : null}

        <Surface>
          <PanelBody className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
            <div className="space-y-1">
              <p className="font-display text-[17px] font-semibold tracking-tight">
                Start with a recent CV
              </p>
              <p className="text-muted-foreground text-[13px] leading-snug">
                You can also add LinkedIn, a portfolio site, or notes. We draft
                a profile in a few seconds — you review and approve. Nothing is
                made up.
              </p>
            </div>

            <FileDropzone
              disabled={pending}
              label="Drop your CV here, or click to browse"
              hint="PDF, TXT, or MD · stays on your machine"
              onFile={(file) => ingestFile(file, "cv")}
              className="[&_label]:py-10"
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                onClick={() => {
                  setFileKind("linkedin_text");
                  setShowMoreSources(true);
                }}
              >
                <FileText className="size-3.5" aria-hidden />
                LinkedIn PDF instead
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                onClick={() => setShowMoreSources((v) => !v)}
              >
                <Link2 className="size-3.5" aria-hidden />
                Website or notes
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    showMoreSources && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            </div>

            {showMoreSources ? (
              <div className="border-border space-y-4 border-t pt-4">
                {moreSourcesPanel}
              </div>
            ) : null}

            {sourceList ? (
              <div className="border-border space-y-2 border-t pt-3">
                <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
                  Sources · {sources.length}
                </p>
                {sourceList}
              </div>
            ) : null}

            {sources.length > 0 && !pending ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run("Profile drafted", async () => {
                      const result = await extractProfileAction();
                      if (result.ok) {
                        setPhaseOverride(null);
                        setReviewTab("essentials");
                      }
                      return result;
                    })
                  }
                >
                  Draft profile from sources
                </Button>
                <p className="text-muted-foreground text-[12px]">
                  Or drop another file — CV upload extracts automatically.
                </p>
              </div>
            ) : null}

            {pending ? (
              <p className="text-muted-foreground text-[13px]">
                Working… extracting stays grounded in your sources.
              </p>
            ) : null}
          </PanelBody>
        </Surface>
      </div>
    );
  }

  if (isOnboarding && phase === "review") {
    return (
      <div className="space-y-3">
        {error ? <p className="text-destructive text-[13px]">{error}</p> : null}
        {message ? (
          <p className="text-muted-foreground text-[13px]">{message}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {approved ? (
              <Badge className="h-6">
                <Check className="size-3" aria-hidden />
                Approved v{approved.version}
              </Badge>
            ) : (
              <Badge variant="outline" className="h-6">
                Review draft
              </Badge>
            )}
            {draft ? (
              <Badge variant="secondary" className="h-6">
                Draft v{draft.version}
              </Badge>
            ) : null}
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-[12px] underline-offset-2 hover:underline"
            onClick={() => setPhaseOverride("sources")}
          >
            Sources ({sources.length})
          </button>
        </div>

        {!active ? (
          <Surface>
            <PanelBody className="px-5 py-5">
              <p className="text-muted-foreground text-[13px]">
                Extract a profile from your sources to edit it here.
              </p>
              <Button
                className="mt-3"
                type="button"
                size="sm"
                onClick={() => setPhaseOverride("sources")}
              >
                Add sources
              </Button>
            </PanelBody>
          </Surface>
        ) : (
          <Surface>
            <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
              <nav
                aria-label="Profile sections"
                className="bg-muted/50 flex flex-wrap gap-0.5 rounded-lg p-0.5"
              >
                {REVIEW_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReviewTab(tab.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                      reviewTab === tab.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              {draft ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={saveDraft}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={approveDraft}
                  >
                    Approve
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-[12px]">
                  Extract again to edit.
                </p>
              )}
            </div>
            <PanelBody className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
              {renderReviewFields()}
              {draft && reviewTab !== "essentials" ? null : draft ? (
                <p className="text-muted-foreground text-[12px] leading-snug">
                  Essentials are enough to continue. Other tabs are optional
                  polish.
                </p>
              ) : null}
            </PanelBody>
          </Surface>
        )}
      </div>
    );
  }

  // Full page layout
  return (
    <div className="space-y-10">
      {error ? (
        <p className="text-destructive text-[14px]">{error}</p>
      ) : null}
      {message ? (
        <p className="text-muted-foreground text-[14px]">{message}</p>
      ) : null}

      <section className="space-y-4">
        <SectionTitle
          title="Sources"
          description="Your CV, LinkedIn, portfolio site, and a short note about you."
        />

        <Surface>
          <PanelBody className="space-y-6">
            {moreSourcesPanel}
            {sourceList ? (
              <>
                <Separator />
                {sourceList}
              </>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="button"
                disabled={pending || sources.length === 0}
                onClick={() =>
                  run("Profile drafted", () => extractProfileAction())
                }
              >
                Draft profile from sources
              </Button>
              {sources.length === 0 ? (
                <p className="text-muted-foreground text-[13px]">
                  Add at least one source first.
                </p>
              ) : null}
            </div>
          </PanelBody>
        </Surface>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="Profile"
          description="Review the draft, then approve it for job matching."
          meta={
            <div className="flex flex-wrap gap-2">
              {approved ? (
                <Badge>Approved v{approved.version}</Badge>
              ) : (
                <Badge variant="outline">Not approved</Badge>
              )}
              {draft ? (
                <Badge variant="secondary">Draft v{draft.version}</Badge>
              ) : null}
            </div>
          }
        />

        {!active ? (
          <Surface>
            <PanelBody>
              <p className="text-muted-foreground text-[14px]">
                Extract a profile from your sources to edit it here.
              </p>
            </PanelBody>
          </Surface>
        ) : (
          <Surface>
            <PanelHeader>
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <span className="text-[15px] font-medium">
                  {draft
                    ? `Draft v${draft.version}`
                    : `Approved v${approved!.version}`}
                </span>
                {draft ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={saveDraft}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={approveDraft}
                    >
                      Approve
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-[13px]">
                    Extract again to edit without changing this version.
                  </p>
                )}
              </div>
            </PanelHeader>
            <PanelBody className="space-y-5">{renderReviewFields()}</PanelBody>
          </Surface>
        )}
      </section>
    </div>
  );
}
