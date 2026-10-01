"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { InlineAlert } from "@/components/inline-alert";
import { JobListItem } from "@/components/job-list-item";
import { Stagger, StaggerItem } from "@/components/motion";
import { PageHeader, Surface } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useJobSearch } from "@/components/job-search-provider";
import { createSessionStore } from "@/lib/session-store";
import { SegmentedControl } from "@/components/segmented-control";
import type { JobTriageRow } from "@/modules/jobs/triage-row";
import {
  STRONG_MATCH_MIN,
  WORTH_A_LOOK_MIN,
  matchTierForScore,
} from "@/modules/matching/tiers";
import { timezoneOverlapVaries } from "@/modules/matching/remote-fit";

export type { JobTriageRow };

type InboxTab = "strong" | "worth_a_look" | "all";
type WorkFilter = "any" | "remote" | "hybrid" | "onsite";

const tabStore = createSessionStore<InboxTab>("optra.jobsInbox.tab", "strong");
const workStore = createSessionStore<WorkFilter>("optra.jobsInbox.work", "any");

/** The all-found list is long; it opens a page at a time. */
const ALL_PAGE_SIZE = 40;

export function JobsInbox({
  rows,
  allRows,
  hasSearchProfile,
  autoSearch = false,
  onSearchingChange,
}: {
  /** The published picks (AI-scored). */
  rows: JobTriageRow[];
  /** Every job the searches found, with a score or an estimate. */
  allRows: JobTriageRow[];
  hasSearchProfile: boolean;
  /** First visit after onboarding: start the first search without a click. */
  autoSearch?: boolean;
  /** Notify parent so navigation/tabs can stay put during sync (Klaviyo-style). */
  onSearchingChange?: (searching: boolean) => void;
}) {
  const router = useRouter();
  // The run itself lives in the app shell so it survives navigation (see JobSearchProvider).
  const { running: searching, start: findJobs, notice, lastOutcome, claimPageCta } = useJobSearch();
  const error = notice.error ?? null;
  const message = notice.message ?? null;

  useEffect(() => {
    onSearchingChange?.(searching);
  }, [searching, onSearchingChange]);

  const tab = tabStore.useValue();
  const setTab = tabStore.set;
  const workFilter = workStore.useValue();
  const [allShown, setAllShown] = useState(ALL_PAGE_SIZE);

  // Land on the tier that actually has results after a finished run.
  useEffect(() => {
    if (lastOutcome?.strong) tabStore.set("strong");
    else if (lastOutcome?.worth) tabStore.set("worth_a_look");
  }, [lastOutcome]);

  const matchesWork = (r: JobTriageRow) => workFilter === "any" || r.workMode === workFilter;

  const visible = useMemo(
    () => rows.filter((r) => r.triageState !== "rejected" && matchesWork(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, workFilter],
  );

  const everyRow = useMemo(
    () => allRows.filter((r) => r.triageState !== "rejected"),
    [allRows],
  );
  const allVisible = useMemo(
    () => everyRow.filter(matchesWork),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [everyRow, workFilter],
  );
  const workCounts = useMemo(() => {
    const counts = { any: everyRow.length, remote: 0, hybrid: 0, onsite: 0 };
    for (const row of everyRow) {
      if (row.workMode !== "unspecified") counts[row.workMode] += 1;
    }
    return counts;
  }, [everyRow]);

  const strongRows = useMemo(
    () =>
      visible.filter(
        (r) => matchTierForScore(r.matchScore) === "strong",
      ),
    [visible],
  );

  const worthRows = useMemo(
    () =>
      visible.filter(
        (r) => matchTierForScore(r.matchScore) === "worth_a_look",
      ),
    [visible],
  );

  const listed = useMemo(() => {
    if (tab === "strong") return strongRows;
    if (tab === "worth_a_look") return worthRows;
    return allVisible.slice(0, allShown);
  }, [tab, strongRows, worthRows, allVisible, allShown]);

  const showTimezoneChip = useMemo(
    () =>
      timezoneOverlapVaries(listed.map((row) => row.remoteFit.timezoneOverlap)),
    [listed],
  );

  useEffect(() => {
    if (searching) return;
    if (strongRows.length === 0 && worthRows.length > 0 && tab === "strong") {
      tabStore.set("worth_a_look");
    } else if (
      strongRows.length === 0 &&
      worthRows.length === 0 &&
      allVisible.length > 0 &&
      tab !== "all"
    ) {
      tabStore.set("all");
    }
  }, [strongRows.length, worthRows.length, allVisible.length, searching, tab]);

  // Nothing found at all (not just nothing under this work mode).
  const isEmpty = rows.length === 0 && everyRow.length === 0;

  // Empty Today owns Find jobs / Set criteria. The topbar repeats it otherwise.
  useEffect(() => {
    claimPageCta(isEmpty);
    return () => claimPageCta(false);
  }, [claimPageCta, isEmpty]);

  const showFallbackBanner =
    !searching &&
    !isEmpty &&
    strongRows.length === 0 &&
    worthRows.length > 0;
  const showAllTab = everyRow.length > 0;

  const autoSearched = useRef(false);
  useEffect(() => {
    if (!autoSearch || autoSearched.current) return;
    const timer = setTimeout(() => {
      autoSearched.current = true;
      router.replace("/");
      if (hasSearchProfile && isEmpty) findJobs();
    }, 0);
    return () => clearTimeout(timer);
    // Runs once on the first visit; findJobs is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch, hasSearchProfile, isEmpty, router]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Today"
        description="Roles found for your search, each with a score."
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {message && !searching ? (
        <InlineAlert variant="info">
          {message.includes("Moved to Saved") ? (
            <>
              Moved to{" "}
              <Link
                href="/interested"
                className="text-brand-ink font-medium underline-offset-4 hover:underline"
              >
                Saved
              </Link>
              .
            </>
          ) : (
            message
          )}
        </InlineAlert>
      ) : null}

      {isEmpty ? (
        <Surface>
          {hasSearchProfile ? (
            <EmptyState
              title="No roles yet"
              description="Search job boards for roles that fit your profile. Takes about a minute."
              icon={
                <Briefcase className="size-5" strokeWidth={1.5} />
              }
              actionId="today-primary-action"
              actionLabel={searching ? "Finding…" : "Find jobs"}
              capsule
              pending={searching}
              onAction={findJobs}
            />
          ) : (
            <EmptyState
              title="Set what to look for"
              description="Tell Optra which roles to search for, then we'll find them."
              icon={<Search className="size-5" strokeWidth={1.5} />}
              actionId="today-primary-action"
              actionLabel="Set search criteria"
              onAction={() => router.push("/search-criteria")}
            />
          )}
        </Surface>
      ) : null}

      {!isEmpty ? (
        <div className="space-y-4">
          <SegmentedControl
            ariaLabel="Match quality"
            value={tab}
            onChange={setTab}
            options={[
              {
                id: "strong",
                label: "Strong matches",
                count: strongRows.length,
              },
              {
                id: "worth_a_look",
                label: "Worth a look",
                count: worthRows.length,
              },
              ...(showAllTab
                ? [{ id: "all" as const, label: "All found", count: allVisible.length }]
                : []),
            ]}
          />

          {showAllTab ? (
            <SegmentedControl
              ariaLabel="Work mode"
              size="sm"
              value={workFilter}
              onChange={(next) => {
                workStore.set(next);
                setAllShown(ALL_PAGE_SIZE);
              }}
              options={[
                { id: "any", label: "Any", count: workCounts.any },
                { id: "remote", label: "Remote", count: workCounts.remote },
                { id: "hybrid", label: "Hybrid", count: workCounts.hybrid },
                { id: "onsite", label: "On-site", count: workCounts.onsite },
              ]}
            />
          ) : null}

          {showFallbackBanner && tab !== "worth_a_look" ? (
            <div className="bg-card text-ink-emphasis rounded-tile px-4 py-3 text-body-sm">
              No strong matches ({STRONG_MATCH_MIN}+) today —{" "}
              <button
                type="button"
                className="text-brand-ink rounded-md font-medium underline-offset-4 hover:underline"
                onClick={() => setTab("worth_a_look")}
              >
                {worthRows.length} worth a look
              </button>{" "}
              below the bar, with caveats.
            </div>
          ) : null}

          {listed.length === 0 ? (
            <Surface className="px-5 py-8">
              <p className="text-muted-foreground text-center text-body-sm">
                {tab === "strong"
                  ? "No strong matches yet. Check Worth a look."
                  : tab === "worth_a_look"
                    ? `Nothing in the ${WORTH_A_LOOK_MIN}–${STRONG_MATCH_MIN - 1} band right now.`
                    : "Nothing found for this work mode."}
              </p>
            </Surface>
          ) : (
            <Stagger as="ul" className="bg-card divide-y divide-border overflow-hidden rounded-card shadow-card">
              {listed.map((row) => (
                <StaggerItem
                  key={row.jobId}
                  as="li"
                  className="min-w-0"
                >
                  <JobListItem
                    variant="today"
                    row={row}
                    showTimezoneChip={showTimezoneChip}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}

          {tab === "all" && allVisible.length > listed.length ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setAllShown((n) => n + ALL_PAGE_SIZE)}>
                Show {Math.min(ALL_PAGE_SIZE, allVisible.length - listed.length)} more
                <span className="text-muted-foreground tabular">
                  ({listed.length} of {allVisible.length})
                </span>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
