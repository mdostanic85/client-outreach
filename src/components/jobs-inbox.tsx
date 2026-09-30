"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Briefcase, Search } from "lucide-react";
import {
  interestedJobAction,
  markJobAppliedAction,
  rejectJobAction,
  saveJobForLaterAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { InlineAlert } from "@/components/inline-alert";
import { JobListItem } from "@/components/job-list-item";
import { Stagger, StaggerItem } from "@/components/motion";
import { PageHeader, Surface } from "@/components/page-shell";
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

const tabStore = createSessionStore<InboxTab>("optra.jobsInbox.tab", "strong");

export function JobsInbox({
  rows,
  hasSearchProfile,
  autoSearch = false,
  onSearchingChange,
}: {
  rows: JobTriageRow[];
  hasSearchProfile: boolean;
  /** First visit after onboarding: start the first search without a click. */
  autoSearch?: boolean;
  /** Notify parent so navigation/tabs can stay put during sync (Klaviyo-style). */
  onSearchingChange?: (searching: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The run itself lives in the app shell so it survives navigation (see JobSearchProvider).
  const { running: searching, start: findJobs, notice, setNotice, lastOutcome, claimPageCta } = useJobSearch();
  const error = notice.error ?? null;
  const message = notice.message ?? null;

  useEffect(() => {
    onSearchingChange?.(searching);
  }, [searching, onSearchingChange]);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tab = tabStore.useValue();
  const setTab = tabStore.set;

  // Land on the tier that actually has results after a finished run.
  useEffect(() => {
    if (lastOutcome?.strong) tabStore.set("strong");
    else if (lastOutcome?.worth) tabStore.set("worth_a_look");
  }, [lastOutcome]);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMessage?: string,
  ) => {
    setNotice({ error: null });
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setNotice({ error: result.error ?? "Failed" });
      else {
        if (okMessage) setNotice({ message: okMessage });
        router.refresh();
      }
    });
  };

  const visible = useMemo(
    () => rows.filter((r) => r.triageState !== "rejected"),
    [rows],
  );

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
    return [...strongRows, ...worthRows];
  }, [tab, strongRows, worthRows]);

  const showTimezoneChip = useMemo(
    () =>
      timezoneOverlapVaries(listed.map((row) => row.remoteFit.timezoneOverlap)),
    [listed],
  );

  useEffect(() => {
    if (searching) return;
    if (strongRows.length === 0 && worthRows.length > 0 && tab === "strong") {
      tabStore.set("worth_a_look");
    }
  }, [strongRows.length, worthRows.length, searching, tab]);

  const isEmpty = visible.length === 0;

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
        description="Roles picked for you, each with why it fits."
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
              actionLabel={pending || searching ? "Finding…" : "Find jobs"}
              capsule
              pending={pending || searching}
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
            ]}
          />

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
                    : "No published matches in either band."}
              </p>
            </Surface>
          ) : (
            <Stagger as="ul" className="bg-card divide-y divide-border overflow-hidden rounded-card">
              {listed.map((row, index) => (
                <StaggerItem
                  key={row.jobId}
                  index={index}
                  as="li"
                  className="min-w-0"
                >
                  <JobListItem
                    variant="today"
                    row={row}
                    expanded={expandedId === row.jobId}
                    pending={pending}
                    rejecting={rejectingId === row.jobId}
                    rejectReason={rejectReason}
                    showTimezoneChip={showTimezoneChip}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === row.jobId ? null : row.jobId,
                      )
                    }
                    onInterested={() =>
                      run(
                        async () => interestedJobAction(row.jobId),
                        "Moved to Saved.",
                      )
                    }
                    onSaveForLater={() =>
                      run(async () => saveJobForLaterAction(row.jobId))
                    }
                    onAlreadyApplied={() =>
                      run(async () => markJobAppliedAction(row.jobId))
                    }
                    onStartReject={() => {
                      setRejectingId(row.jobId);
                      setRejectReason("");
                    }}
                    onRejectReason={setRejectReason}
                    onConfirmReject={() =>
                      run(async () => {
                        const res = await rejectJobAction(
                          row.jobId,
                          rejectReason,
                        );
                        setRejectingId(null);
                        return res;
                      })
                    }
                    onCancelReject={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      ) : null}
    </div>
  );
}
