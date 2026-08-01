"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveSearchProfileAction,
  generateSearchProfileAction,
  runJobPipelineAction,
  saveSearchProfileDraftAction,
} from "@/app/actions";
import {
  PageHeader,
  PageShell,
  PanelHeader,
  Surface,
} from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
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

  const body = (
    <>
      {error ? (
        <p className="text-sm text-destructive mb-4">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          disabled={pending}
          onClick={() =>
            run(async () => generateSearchProfileAction(), "Draft generated")
          }
        >
          Regenerate from profile
        </Button>
        {draft ? (
          <>
            <Button
              variant="secondary"
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
        {approved && !embedded ? (
          <Button
            variant="outline"
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
              <p className="text-sm text-muted-foreground">
                {approved.approvedAt
                  ? `Approved ${new Date(approved.approvedAt).toLocaleString()}`
                  : "Approved"}
              </p>
            </div>
          </PanelHeader>
          <p className="text-sm text-muted-foreground px-4 pb-4">
            Titles: {approved.params.targetTitles.join(", ")} · Locations:{" "}
            {approved.params.locations.join(", ")}
          </p>
        </Surface>
      ) : (
        <p className="text-sm text-muted-foreground mb-6">
          No approved search criteria yet. Generate a draft and approve it.
        </p>
      )}

      {draft ? (
        <Surface>
          <PanelHeader>
            <div>
              <p className="font-medium">Draft v{draft.version}</p>
              <p className="text-sm text-muted-foreground">
                Edit before approving
              </p>
            </div>
          </PanelHeader>
          {draft.rationale.length > 0 ? (
            <ul className="px-4 pb-3 text-sm text-muted-foreground list-disc pl-8">
              {draft.rationale.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <label className="text-sm space-y-1">
              <span className="font-medium">Target titles (one per line)</span>
              <textarea
                className="w-full min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
                value={titles}
                onChange={(e) => setTitles(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Excluded titles</span>
              <textarea
                className="w-full min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
                value={excluded}
                onChange={(e) => setExcluded(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Locations</span>
              <textarea
                className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Search keywords</span>
              <textarea
                className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="font-medium">Excluded keywords</span>
              <textarea
                className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                value={excludedKw}
                onChange={(e) => setExcludedKw(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="font-medium">
                Career page URLs (one per line)
              </span>
              <textarea
                className="w-full min-h-28 rounded-md border bg-background px-3 py-2 text-sm font-mono text-[13px]"
                value={boards}
                onChange={(e) => setBoards(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Posted within (hours)</span>
              <Input
                value={postedWithin}
                onChange={(e) => setPostedWithin(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Max jobs to pull / day</span>
              <Input value={maxRaw} onChange={(e) => setMaxRaw(e.target.value)} />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Max board spend / day (USD)</span>
              <Input
                value={maxApify}
                onChange={(e) => setMaxApify(e.target.value)}
              />
            </label>
          </div>
        </Surface>
      ) : null}
    </>
  );

  if (embedded) return <div className="space-y-2">{body}</div>;

  return (
    <PageShell>
      <PageHeader
        title="Job search criteria"
        description="Drafted from your profile. Approve before we look for jobs."
      />
      {body}
    </PageShell>
  );
}
