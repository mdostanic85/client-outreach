"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import {
  approveSearchProfileAction,
  generateSearchProfileAction,
  runJobPipelineAction,
  saveSearchProfileDraftAction,
} from "@/app/actions";
import {
  PageHeader,
  PageShell,
  PanelBody,
  PanelHeader,
  Surface,
} from "@/components/page-shell";
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
  const [showAdvanced, setShowAdvanced] = useState(!embedded);

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
  const [postedWithin, setPostedWithin] = useState(
    String(source?.params.postedWithinHours ?? 48),
  );
  const [maxRaw, setMaxRaw] = useState(
    String(source?.params.maxDailyRawJobs ?? 100),
  );
  const [maxApify, setMaxApify] = useState(
    String(source?.params.maxDailyApifyUsd ?? 1.5),
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
    setPostedWithin(String(next?.postedWithinHours ?? 48));
    setMaxRaw(String(next?.maxDailyRawJobs ?? 100));
    setMaxApify(String(next?.maxDailyApifyUsd ?? 1.5));
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

  const buildParams = (): JobSearchParams => {
    const base = source?.params;
    return {
      targetTitles: linesToList(titles),
      excludedTitles: linesToList(excluded),
      locations: linesToList(locations),
      employmentTypes: base?.employmentTypes ?? ["Full-time", "Contract"],
      postedWithinHours: Number(postedWithin) || 48,
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
      ],
      maxResultsPerQuery: base?.maxResultsPerQuery ?? 15,
      maxDailyRawJobs: Number(maxRaw) || 100,
      maxDailyApifyUsd: Number(maxApify) || 1.5,
    };
  };

  const essentialsForm = (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Target titles</span>
        <p className="text-muted-foreground text-[12px]">One per line</p>
        <textarea
          className="bg-background min-h-32 w-full rounded-lg border px-3.5 py-2.5 text-[14px]"
          value={titles}
          onChange={(e) => setTitles(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Excluded titles</span>
        <p className="text-muted-foreground text-[12px]">Skip these roles</p>
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
        <p className="text-muted-foreground text-[12px]">One per line</p>
        <textarea
          className="bg-background min-h-28 w-full rounded-lg border px-3.5 py-2.5 font-mono text-[13px]"
          value={boards}
          onChange={(e) => setBoards(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="space-y-2 text-[14px]">
        <span className="font-medium">Posted within (hours)</span>
        <Input
          value={postedWithin}
          onChange={(e) => setPostedWithin(e.target.value)}
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
        {error ? (
          <p className="text-destructive text-[14px]">{error}</p>
        ) : null}
        {message ? (
          <p className="text-muted-foreground text-[14px]">{message}</p>
        ) : null}

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
                  <Badge className="h-7 px-2.5 text-[13px]">
                    <Check className="size-3.5" aria-hidden />
                    Approved
                    {approved.version ? ` v${approved.version}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-7 px-2.5 text-[13px]">
                    Review draft
                    {draft ? ` v${draft.version}` : ""}
                  </Badge>
                )}
                {draft && approved ? (
                  <Badge variant="secondary" className="h-7 px-2.5 text-[13px]">
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
              {canApprove ? (
                <div className="border-border flex flex-wrap items-center gap-3 border-t pt-5">
                  <Button
                    size="lg"
                    className="h-11 px-5 text-[15px]"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        await saveSearchProfileDraftAction(
                          draft!.id,
                          buildParams(),
                        );
                        return approveSearchProfileAction(draft!.id);
                      }, "Search criteria approved")
                    }
                  >
                    Approve criteria
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-11 px-3 text-[14px]"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        return saveSearchProfileDraftAction(
                          draft!.id,
                          buildParams(),
                          draft!.rationale,
                        );
                      }, "Draft saved")
                    }
                  >
                    Save draft
                  </Button>
                  <p className="text-muted-foreground text-[13px]">
                    Then continue below when you’re ready.
                  </p>
                </div>
              ) : isApproved || approved ? (
                <p className="text-muted-foreground border-border border-t pt-5 text-[14px]">
                  Criteria approved. Continue below — or regenerate to revise.
                </p>
              ) : null}
            </PanelBody>
          </Surface>
        )}
      </div>
    );
  }

  // Full page (non-onboarding)
  const body = (
    <>
      {error ? (
        <p className="text-destructive mb-4 text-sm">{error}</p>
      ) : null}
      {message ? (
        <p className="text-muted-foreground mb-4 text-sm">{message}</p>
      ) : null}

      <div className="mb-8 flex flex-wrap gap-2.5">
        <Button
          variant="outline"
          size="lg"
          className="h-11 px-5 text-[15px]"
          disabled={pending}
          onClick={() =>
            run(async () => generateSearchProfileAction(), "Draft generated")
          }
        >
          {draft || approved ? "Regenerate from profile" : "Generate from profile"}
        </Button>
        {draft ? (
          <>
            <Button
              variant="ghost"
              size="lg"
              className="h-11 px-4 text-[15px]"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const params = buildParams();
                  return saveSearchProfileDraftAction(
                    draft.id,
                    params,
                    draft.rationale,
                  );
                }, "Draft saved")
              }
            >
              Save draft
            </Button>
            <Button
              size="lg"
              className="h-11 px-5 text-[15px]"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await saveSearchProfileDraftAction(draft.id, buildParams());
                  return approveSearchProfileAction(draft.id);
                }, "Search criteria approved")
              }
            >
              Approve for finding jobs
            </Button>
          </>
        ) : null}
        {approved && !draft ? (
          <Button
            variant="secondary"
            size="lg"
            className="h-11 px-5 text-[15px]"
            disabled={pending}
            onClick={() =>
              run(async () => runJobPipelineAction(), "Job search finished")
            }
          >
            Find jobs now
          </Button>
        ) : null}
      </div>

      {approved ? (
        <Surface className="mb-6">
          <PanelHeader>
            <div>
              <p className="font-medium">Active v{approved.version}</p>
              <p className="text-muted-foreground text-sm">
                {approved.approvedAt
                  ? `Approved ${new Date(approved.approvedAt).toLocaleString()}`
                  : "Approved"}
              </p>
            </div>
          </PanelHeader>
          <p className="text-muted-foreground px-4 pb-4 text-sm">
            Titles: {approved.params.targetTitles.join(", ")} · Locations:{" "}
            {approved.params.locations.join(", ")}
          </p>
        </Surface>
      ) : (
        <p className="text-muted-foreground mb-6 text-sm">
          No approved search criteria yet. Generate a draft and approve it.
        </p>
      )}

      {draft ? (
        <Surface>
          <PanelHeader>
            <div>
              <p className="font-medium">Draft v{draft.version}</p>
              <p className="text-muted-foreground text-sm">
                Edit before approving
              </p>
            </div>
          </PanelHeader>
          {draft.rationale.length > 0 ? (
            <ul className="text-muted-foreground list-disc px-4 pb-3 pl-8 text-sm">
              {draft.rationale.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          <div className="space-y-6 p-5 md:p-6">
            {essentialsForm}
            {advancedForm}
          </div>
        </Surface>
      ) : null}
    </>
  );

  return (
    <PageShell>
      <PageHeader
        title="Job search criteria"
        description="Drafted from your approved profile. Review, then approve before finding jobs."
      />
      {body}
    </PageShell>
  );
}
