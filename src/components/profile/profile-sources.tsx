"use client";

import { useState } from "react";
import { deleteProfileSourceAction, extractProfileAction, ingestCvAction, ingestGithubAction, ingestManualNotesAction, ingestPortfolioUrlAction, ingestTextSourceAction, setMatchingSourcesConfigAction, setProfileSourceMatchingEnabledAction } from "@/modules/profile/actions";
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
import type { MatchingSourcesConfig } from "@/modules/profile/matching-sources-core";

import type { ActionRunner } from "@/components/use-action-runner";

export type SourceView = {
  id: string;
  type: string;
  label: string | null;
  sourceUrl: string | null;
  ingestedAt: string;
  textLength: number;
  lastSyncedAt?: string | null;
  enabledForMatching?: boolean;
};

export const SOURCE_LABELS: Record<string, string> = {
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

/**
 * Sources that feed the profile (CV, LinkedIn, website, GitHub, notes): the
 * list with per-source matching switches, removal, and the forms to add more.
 */
export function ProfileSources({
  sources,
  matchingConfig,
  hasProfile,
  initiallyOpen,
  runner,
  children,
}: {
  sources: SourceView[];
  matchingConfig: MatchingSourcesConfig;
  hasProfile: boolean;
  initiallyOpen: boolean;
  runner: Pick<ActionRunner, "pending" | "run">;
  children?: React.ReactNode;
}) {
  const { pending, run: runWith } = runner;
  const run = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    runWith(fn, { success: label });
  const [fileKind, setFileKind] = useState<"cv" | "linkedin_text">("cv");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [githubInput, setGithubInput] = useState("");
  const [aboutYou, setAboutYou] = useState("");
  const [linkedinPaste, setLinkedinPaste] = useState("");
  const [showLinkedinPaste, setShowLinkedinPaste] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(initiallyOpen);
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
    // Show the switch flipped right away; undo it if the server refuses.
    setMatchingOverride((prev) => ({ ...prev, [source.id]: enabled }));
    runWith(async () => {
      const result = await setProfileSourceMatchingEnabledAction(source.id, enabled);
      if (!result.ok) {
        setMatchingOverride((prev) => {
          const next = { ...prev };
          delete next[source.id];
          return next;
        });
        return result;
      }
      // The category switch follows: on with any source, off with the last one.
      if (category && (enabled || !othersOn)) {
        return setMatchingSourcesConfigAction({ [category]: enabled });
      }
      return result;
    });
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

  const pageSourcesOpen = sourcesOpen || !hasProfile;

  return (
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
          {sources.length > 0 && hasProfile ? (
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
  );
}
