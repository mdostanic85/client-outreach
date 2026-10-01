"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { approveSearchProfileAction, createSearchDraftFromApprovedAction, generateSearchProfileAction, saveSearchProfileDraftAction } from "@/modules/search-profile/actions";
import { EmptyState } from "@/components/empty-state";
import { InlineAlert } from "@/components/inline-alert";
import {
  PageHeader,
  PageShell,
  PanelBody,
  PanelHeader,
  Surface,
} from "@/components/page-shell";
import { StickyFormActions } from "@/components/sticky-form-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formValuesToParams,
  paramsToFormValues,
  type CriteriaFormValues,
} from "@/modules/search-profile/criteria-form";
import type { JobSearchParams } from "@/modules/search-profile/schemas";

export function SearchCriteriaWorkspace({
  draft,
  approved,
  embedded = false,
}: {
  draft: {
    id: string;
    version: number;
    params: JobSearchParams;
    rationale: string[];
  } | null;
  approved: {
    id: string;
    version: number;
    params: JobSearchParams;
    approvedAt: string | null;
  } | null;
  /** Skip page chrome when nested in the onboarding wizard. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const source = draft ?? approved;
  const [values, setValues] = useState<CriteriaFormValues>(() => paramsToFormValues(source?.params));
  const set = (key: keyof CriteriaFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const formKey = `${draft?.id ?? "none"}-${draft?.version ?? 0}-${approved?.id ?? "none"}`;
  const [lastKey, setLastKey] = useState(formKey);
  if (formKey !== lastKey) {
    setLastKey(formKey);
    setValues(paramsToFormValues(draft?.params ?? approved?.params));
  }

  // Onboarding: auto-generate once if we landed without a draft.
  const autoGenerateAttempted = useRef(false);
  useEffect(() => {
    if (!embedded || draft || approved || pending || autoGenerateAttempted.current)
      return;
    autoGenerateAttempted.current = true;
    startTransition(async () => {
      setError(null);
      const result = await generateSearchProfileAction();
      if (!result.ok) {
        autoGenerateAttempted.current = false;
        setError(result.error ?? "Could not generate criteria");
      } else {
        router.refresh();
      }
    });
  }, [embedded, draft, approved, pending, router]);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string,
  ) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else {
        if (okMsg) setMessage(okMsg);
        router.refresh();
      }
    });
  };

  const approveFromForm = () =>
    run(async () => {
      if (draft) {
        // Approving must never publish an older draft than the one on screen.
        const saved = await saveSearchProfileDraftAction(draft.id, buildParams());
        if (!saved.ok) return saved;
        return approveSearchProfileAction(draft.id);
      }
      const created = await createSearchDraftFromApprovedAction(buildParams());
      if (!created.ok) {
        return { ok: false, error: created.error };
      }
      return approveSearchProfileAction(created.data.id);
    }, "Search criteria approved");

  const saveDraftFromForm = () =>
    run(async () => {
      if (draft) {
        return saveSearchProfileDraftAction(
          draft.id,
          buildParams(),
          draft.rationale,
        );
      }
      return createSearchDraftFromApprovedAction(buildParams());
    }, "Draft saved");

  const buildParams = (): JobSearchParams => formValuesToParams(values, source?.params);

  const essentialsForm = (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      <label className="space-y-2 text-body-sm">
        <span className="font-medium">Target titles</span>
        <p className="text-muted-foreground text-body-sm">One per line</p>
        <textarea
          className="bg-card border-input min-h-32 w-full rounded-tile border px-4 py-3 outline-none transition-colors duration-150 focus-visible:border-brand text-body-sm"
          value={values.titles}
          onChange={(e) => set("titles", e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-body-sm">
        <span className="font-medium">Excluded titles</span>
        <p className="text-muted-foreground text-body-sm">Skip these roles</p>
        <textarea
          className="bg-card border-input min-h-32 w-full rounded-tile border px-4 py-3 outline-none transition-colors duration-150 focus-visible:border-brand text-body-sm"
          value={values.excluded}
          onChange={(e) => set("excluded", e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-body-sm">
        <span className="font-medium">Locations</span>
        <textarea
          className="bg-card border-input min-h-28 w-full rounded-tile border px-4 py-3 outline-none transition-colors duration-150 focus-visible:border-brand text-body-sm"
          value={values.locations}
          onChange={(e) => set("locations", e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-body-sm">
        <span className="font-medium">Search keywords</span>
        <textarea
          className="bg-card border-input min-h-28 w-full rounded-tile border px-4 py-3 outline-none transition-colors duration-150 focus-visible:border-brand text-body-sm"
          value={values.keywords}
          onChange={(e) => set("keywords", e.target.value)}
          disabled={pending}
        />
      </label>
    </div>
  );

  const advancedForm = (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      <label className="space-y-2 text-body-sm md:col-span-2">
        <span className="font-medium">Excluded keywords</span>
        <textarea
          className="bg-card border-input min-h-24 w-full rounded-tile border px-4 py-3 outline-none transition-colors duration-150 focus-visible:border-brand text-body-sm"
          value={values.excludedKw}
          onChange={(e) => set("excludedKw", e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-body-sm md:col-span-2">
        <span className="font-medium">Career page URLs</span>
        <p className="text-muted-foreground text-body-sm">One per line</p>
        <textarea
          className="bg-card border-input min-h-28 w-full rounded-tile border px-4 py-3 outline-none transition-colors duration-150 focus-visible:border-brand font-mono text-body"
          value={values.boards}
          onChange={(e) => set("boards", e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-body-sm">
        <span className="font-medium">Posted within (days)</span>
        <Input
          type="number"
          min={1}
          step={1}
          value={values.postedWithinDays}
          onChange={(e) => set("postedWithinDays", e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-body-sm">
        <span className="font-medium">Max jobs / day</span>
        <Input
          value={values.maxRaw}
          onChange={(e) => set("maxRaw", e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-body-sm">
        <span className="font-medium">Max board spend / day (USD)</span>
        <Input
          value={values.maxApify}
          onChange={(e) => set("maxApify", e.target.value)}
          disabled={pending}
        />
      </label>
    </div>
  );

  if (embedded) {
    const isApproved = Boolean(approved) && !draft;
    // When both exist, draft is editable; approved is prior version.
    const canApprove = Boolean(draft);

    return (
      <div className="space-y-5">
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        {message ? <InlineAlert variant="info">{message}</InlineAlert> : null}

        {!draft && !approved ? (
          <Surface>
            <PanelBody className="space-y-5 px-6 py-8 sm:px-8">
              <div className="space-y-2">
                <p className="text-body-lg font-medium sm:text-h5">
                  {pending
                    ? "Drafting search criteria…"
                    : "Generate search criteria"}
                </p>
                <p className="text-muted-foreground max-w-xl text-body leading-relaxed">
                  We’ll draft titles, locations, and boards from your approved
                  profile. You review before anything runs.
                </p>
              </div>
              <Button
                size="lg"
                disabled={pending}
                onClick={() =>
                  run(
                    async () => generateSearchProfileAction(),
                    "Draft generated",
                  )
                }
              >
                {pending ? "Generating…" : "Generate from profile"}
              </Button>
            </PanelBody>
          </Surface>
        ) : (
          <Surface>
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                {approved ? (
                  <Badge size="lg">
                    <Check className="size-3.5" aria-hidden />
                    Approved
                    {approved.version ? ` v${approved.version}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" size="lg">
                    Review draft
                    {draft ? ` v${draft.version}` : ""}
                  </Badge>
                )}
                {draft && approved ? (
                  <Badge variant="secondary" size="lg">
                    Editing new draft
                  </Badge>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    async () => generateSearchProfileAction(),
                    "Draft regenerated",
                  )
                }
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Regenerate
              </Button>
            </div>

            <PanelBody className="space-y-6 px-5 py-6 sm:px-6 sm:py-7">
              {draft && draft.rationale.length > 0 ? (
                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-body-sm">
                  {draft.rationale.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}

              {essentialsForm}

              <div className="space-y-4">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md text-body-sm font-medium transition-colors duration-150"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? "Hide" : "Show"} boards & limits
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-standard",
                      showAdvanced && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {showAdvanced ? advancedForm : null}
              </div>

              {/* Single primary in this region — footer Continue appears only after approve */}
              {canApprove || isApproved ? (
                <div className="border-border flex flex-wrap items-center gap-3 border-t pt-5">
                  <Button
                    size="lg"
                        disabled={pending}
                    onClick={approveFromForm}
                  >
                    Approve criteria
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    disabled={pending}
                    onClick={saveDraftFromForm}
                  >
                    Save draft
                  </Button>
                  <p className="text-muted-foreground text-body">
                    {canApprove
                      ? "Then continue below when you’re ready."
                      : "Saves your edits as the new approved criteria."}
                  </p>
                </div>
              ) : null}
            </PanelBody>
          </Surface>
        )}
      </div>
    );
  }

  // Full page — same card + primary CTA pattern as onboarding / Today
  const canApprove = Boolean(draft);
  const isApprovedOnly = Boolean(approved) && !draft;
  const showApproveActions = canApprove || isApprovedOnly;

  return (
    <PageShell width="setup">
      <PageHeader
        title="Search criteria"
        description="Drafted from your profile. Approve before finding jobs on Today."
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {message ? <InlineAlert variant="info">{message}</InlineAlert> : null}

      {!draft && !approved ? (
        <Surface>
          <EmptyState
            title="No search criteria yet"
            description="Generate titles, locations, and boards from your approved profile. You review before anything runs."
            actionLabel={pending ? "Generating…" : "Generate from profile"}
            pending={pending}
            onAction={() =>
              run(async () => generateSearchProfileAction(), "Draft generated")
            }
          />
        </Surface>
      ) : (
        <Surface>
          <PanelHeader className="justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {approved ? (
                <Badge size="lg">
                  <Check className="size-3.5" aria-hidden />
                  Approved
                  {approved.version ? ` v${approved.version}` : ""}
                </Badge>
              ) : (
                <Badge variant="outline" size="lg">
                  Review draft
                  {draft ? ` v${draft.version}` : ""}
                </Badge>
              )}
              {draft && approved ? (
                <Badge variant="secondary" size="lg">
                  Editing new draft
                </Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={pending}
              onClick={() =>
                run(
                  async () => generateSearchProfileAction(),
                  "Draft regenerated",
                )
              }
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Regenerate
            </Button>
          </PanelHeader>

          <PanelBody className="space-y-6">
            {approved && !draft ? (
              <p className="text-muted-foreground text-body-sm leading-relaxed">
                Titles: {approved.params.targetTitles.join(", ")} · Locations:{" "}
                {approved.params.locations.join(", ")}
              </p>
            ) : null}

            {draft && draft.rationale.length > 0 ? (
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-body-sm">
                {draft.rationale.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}

            {essentialsForm}

            <div className="space-y-4">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-body-sm font-medium underline-offset-2 hover:underline"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "Show"} boards & limits
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    showAdvanced && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {showAdvanced ? advancedForm : null}
            </div>

          </PanelBody>
        </Surface>
      )}

      {showApproveActions ? (
        <StickyFormActions
          message={
            canApprove
              ? "Review titles and locations, then approve."
              : "Edit titles and locations, then approve to update."
          }
        >
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={saveDraftFromForm}
          >
            Save draft
          </Button>
          <Button size="lg" disabled={pending} onClick={approveFromForm}>
            Approve criteria
          </Button>
        </StickyFormActions>
      ) : null}
    </PageShell>
  );
}
