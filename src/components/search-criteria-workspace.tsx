"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import {
  approveSearchProfileAction,
  createSearchDraftFromApprovedAction,
  generateSearchProfileAction,
  saveSearchProfileDraftAction,
} from "@/app/actions";
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
import type { JobSearchParams } from "@/modules/search-profile/schemas";

function listToLines(items: string[]) {
  return items.join("\n");
}

function linesToList(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_POSTED_WITHIN_HOURS = 48;

function hoursToDays(hours: number) {
  return Math.max(1, Math.round(hours / 24));
}

function daysToHours(days: number) {
  return Math.max(1, Math.round(days)) * 24;
}

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
  const [titles, setTitles] = useState(
    listToLines(source?.params.targetTitles ?? []),
  );
  const [excluded, setExcluded] = useState(
    listToLines(source?.params.excludedTitles ?? []),
  );
  const [locations, setLocations] = useState(
    listToLines(source?.params.locations ?? []),
  );
  const [keywords, setKeywords] = useState(
    listToLines(source?.params.searchKeywords ?? []),
  );
  const [excludedKw, setExcludedKw] = useState(
    listToLines(source?.params.excludedKeywords ?? []),
  );
  const [boards, setBoards] = useState(
    listToLines(source?.params.atsBoardUrls ?? []),
  );
  const [postedWithinDays, setPostedWithinDays] = useState(
    String(
      hoursToDays(source?.params.postedWithinHours ?? DEFAULT_POSTED_WITHIN_HOURS),
    ),
  );
  const [maxRaw, setMaxRaw] = useState(
    String(source?.params.maxDailyRawJobs ?? 80),
  );
  const [maxApify, setMaxApify] = useState(
    String(source?.params.maxDailyApifyUsd ?? 0.5),
  );

  const formKey = `${draft?.id ?? "none"}-${draft?.version ?? 0}-${approved?.id ?? "none"}`;
  const [lastKey, setLastKey] = useState(formKey);
  if (formKey !== lastKey) {
    setLastKey(formKey);
    const next = draft?.params ?? approved?.params;
    setTitles(listToLines(next?.targetTitles ?? []));
    setExcluded(listToLines(next?.excludedTitles ?? []));
    setLocations(listToLines(next?.locations ?? []));
    setKeywords(listToLines(next?.searchKeywords ?? []));
    setExcludedKw(listToLines(next?.excludedKeywords ?? []));
    setBoards(listToLines(next?.atsBoardUrls ?? []));
    setPostedWithinDays(
      String(
        hoursToDays(next?.postedWithinHours ?? DEFAULT_POSTED_WITHIN_HOURS),
      ),
    );
    setMaxRaw(String(next?.maxDailyRawJobs ?? 80));
    setMaxApify(String(next?.maxDailyApifyUsd ?? 0.5));
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
        await saveSearchProfileDraftAction(draft.id, buildParams());
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

  const buildParams = (): JobSearchParams => {
    const base = source?.params;
    return {
      targetTitles: linesToList(titles),
      excludedTitles: linesToList(excluded),
      locations: linesToList(locations),
      employmentTypes: base?.employmentTypes ?? ["Full-time", "Contract"],
      postedWithinHours: Number(postedWithinDays)
        ? daysToHours(Number(postedWithinDays))
        : DEFAULT_POSTED_WITHIN_HOURS,
      searchKeywords: linesToList(keywords),
      excludedKeywords: linesToList(excludedKw),
      requiredSkills: base?.requiredSkills ?? [],
      preferredSkills: base?.preferredSkills ?? [],
      seniority: base?.seniority ?? [],
      remoteRequired: base?.remoteRequired ?? true,
      remotePolicy: base?.remotePolicy ?? "remote_ok_required",
      priorityIndustries: base?.priorityIndustries ?? [],
      avoidIndustries: base?.avoidIndustries ?? [],
      salary: base?.salary,
      atsBoardUrls: linesToList(boards),
      sourcesEnabled: base?.sourcesEnabled ?? [
        "remotive",
        "arbeitnow",
        "greenhouse",
        "lever",
        "ashby",
        "linkedin",
        "helloworld",
      ],
      maxResultsPerQuery: base?.maxResultsPerQuery ?? 12,
      maxDailyRawJobs: Number(maxRaw) || 80,
      maxDailyApifyUsd: Number(maxApify) || 0.5,
    };
  };

  const essentialsForm = (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Target titles</span>
        <p className="text-muted-foreground text-[14px]">One per line</p>
        <textarea
          className="bg-background min-h-32 w-full rounded-lg border px-3.5 py-2.5 text-[14px]"
          value={titles}
          onChange={(e) => setTitles(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Excluded titles</span>
        <p className="text-muted-foreground text-[14px]">Skip these roles</p>
        <textarea
          className="bg-background min-h-32 w-full rounded-lg border px-3.5 py-2.5 text-[14px]"
          value={excluded}
          onChange={(e) => setExcluded(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Locations</span>
        <textarea
          className="bg-background min-h-28 w-full rounded-lg border px-3.5 py-2.5 text-[14px]"
          value={locations}
          onChange={(e) => setLocations(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Search keywords</span>
        <textarea
          className="bg-background min-h-28 w-full rounded-lg border px-3.5 py-2.5 text-[14px]"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          disabled={pending}
        />
      </label>
    </div>
  );

  const advancedForm = (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      <label className="space-y-2 text-[14px] md:col-span-2">
        <span className="font-medium">Excluded keywords</span>
        <textarea
          className="bg-background min-h-24 w-full rounded-lg border px-3.5 py-2.5 text-[14px]"
          value={excludedKw}
          onChange={(e) => setExcludedKw(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px] md:col-span-2">
        <span className="font-medium">Career page URLs</span>
        <p className="text-muted-foreground text-[14px]">One per line</p>
        <textarea
          className="bg-background min-h-28 w-full rounded-lg border px-3.5 py-2.5 font-mono text-[15px]"
          value={boards}
          onChange={(e) => setBoards(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Posted within (days)</span>
        <Input
          type="number"
          min={1}
          step={1}
          value={postedWithinDays}
          onChange={(e) => setPostedWithinDays(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Max jobs / day</span>
        <Input
          value={maxRaw}
          onChange={(e) => setMaxRaw(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Max board spend / day (USD)</span>
        <Input
          value={maxApify}
          onChange={(e) => setMaxApify(e.target.value)}
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
                <p className="font-display text-[18px] font-semibold tracking-tight sm:text-[20px]">
                  {pending
                    ? "Drafting search criteria…"
                    : "Generate search criteria"}
                </p>
                <p className="text-muted-foreground max-w-xl text-[15px] leading-relaxed">
                  We’ll draft titles, locations, and boards from your approved
                  profile. You review before anything runs.
                </p>
              </div>
              <Button
                size="lg"
                className="h-11 px-5 text-[15px]"
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
                  <Badge className="h-7 px-2.5 text-[15px]">
                    <Check className="size-3.5" aria-hidden />
                    Approved
                    {approved.version ? ` v${approved.version}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-7 px-2.5 text-[15px]">
                    Review draft
                    {draft ? ` v${draft.version}` : ""}
                  </Badge>
                )}
                {draft && approved ? (
                  <Badge variant="secondary" className="h-7 px-2.5 text-[15px]">
                    Editing new draft
                  </Badge>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 gap-2 px-4 text-[14px]"
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
                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-[14px]">
                  {draft.rationale.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}

              {essentialsForm}

              <div className="space-y-4">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-2 hover:underline"
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

              {/* Single primary in this region — footer Continue appears only after approve */}
              {canApprove || isApproved ? (
                <div className="border-border flex flex-wrap items-center gap-3 border-t pt-5">
                  <Button
                    size="lg"
                    className="h-11 px-5 text-[15px]"
                    disabled={pending}
                    onClick={approveFromForm}
                  >
                    Approve criteria
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-11 px-3 text-[14px]"
                    disabled={pending}
                    onClick={saveDraftFromForm}
                  >
                    Save draft
                  </Button>
                  <p className="text-muted-foreground text-[15px]">
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

  const headerActions =
    !draft && !approved ? (
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          run(async () => generateSearchProfileAction(), "Draft generated")
        }
      >
        {pending ? "Generating…" : "Generate from profile"}
      </Button>
    ) : showApproveActions ? (
      <Button size="lg" disabled={pending} onClick={approveFromForm}>
        Approve criteria
      </Button>
    ) : null;

  return (
    <PageShell width="setup">
      <PageHeader
        title="Search criteria"
        description="Drafted from your profile. Approve before finding jobs on Today."
        actions={headerActions}
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
                <Badge className="h-7 px-2.5 text-[15px]">
                  <Check className="size-3.5" aria-hidden />
                  Approved
                  {approved.version ? ` v${approved.version}` : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="h-7 px-2.5 text-[15px]">
                  Review draft
                  {draft ? ` v${draft.version}` : ""}
                </Badge>
              )}
              {draft && approved ? (
                <Badge variant="secondary" className="h-7 px-2.5 text-[15px]">
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
              <p className="text-muted-foreground text-[14px] leading-relaxed">
                Titles: {approved.params.targetTitles.join(", ")} · Locations:{" "}
                {approved.params.locations.join(", ")}
              </p>
            ) : null}

            {draft && draft.rationale.length > 0 ? (
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-[14px]">
                {draft.rationale.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}

            {essentialsForm}

            <div className="space-y-4">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-2 hover:underline"
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

            {isApprovedOnly ? (
              <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/")}
                >
                  Go to Today
                </Button>
                <p className="text-muted-foreground text-[15px]">
                  Edit above, then Approve criteria — or regenerate to start
                  over.
                </p>
              </div>
            ) : null}
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
