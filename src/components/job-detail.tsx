"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCheck,
  Clock,
  ExternalLink,
  MoreHorizontal,
  ThumbsDown,
  Undo2,
} from "lucide-react";
import {
  interestedJobAction,
  markJobAppliedAction,
  rejectJobAction,
  saveJobForLaterAction,
} from "@/app/actions";
import { CompanySnapshotCard } from "@/components/company-snapshot";
import { InlineAlert } from "@/components/inline-alert";
import { CompanyTile } from "@/components/job-list-item";
import { JobMatchInsights } from "@/components/match-insights";
import { AnimateIn } from "@/components/motion";
import { PageShell, Surface } from "@/components/page-shell";
import { ScoreBadge } from "@/components/score-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { PackageListMeta } from "@/modules/applications/packages";
import {
  formatPostedDate,
  packageBadgeLabel,
  packageCta,
} from "@/modules/jobs/job-presentation";
import type { JobTriageRow } from "@/modules/jobs/triage-row";

const REJECT_REASONS = [
  "Wrong title",
  "Wrong seniority",
  "Wrong location / remote",
  "Wrong industry",
  "Comp too low",
  "Company type mismatch",
  "Other",
] as const;

const DESCRIPTION_PREVIEW = 1400;

/** Where the job sits in the user's flow, in plain words. */
const STATE_LABEL: Record<string, { label: string; tone: "brand" | "secondary" | "success" | "outline" }> = {
  interested: { label: "Saved", tone: "brand" },
  saved: { label: "Deciding later", tone: "secondary" },
  applied: { label: "Applied", tone: "success" },
  rejected: { label: "Not interested", tone: "outline" },
};

/**
 * Job page: everything about one opening in a fixed order — what it is, why
 * it fits, the posting itself — with the company and the next step beside it.
 * All triage actions live here.
 */
export function JobDetail({
  row,
  description,
  packageMeta,
}: {
  row: JobTriageRow;
  description: string;
  packageMeta: PackageListMeta | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const state = row.triageState;
  const saved = state === "interested";
  const back = saved ? { href: "/interested", label: "Saved" } : { href: "/", label: "Today" };
  const stateLabel = STATE_LABEL[state] ?? null;
  const posted = formatPostedDate(row.postedAt);
  const packageLabel = saved ? packageBadgeLabel(packageMeta) : null;
  const cta = packageCta(row.jobId, packageMeta);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    after: { message?: string; goTo?: string } = {},
  ) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        return;
      }
      if (after.goTo) {
        router.push(after.goTo);
        return;
      }
      if (after.message) setNotice(after.message);
      router.refresh();
    });
  };

  const save = () =>
    run(() => interestedJobAction(row.jobId), {
      message: "Saved. Prepare your application whenever you're ready.",
    });
  const decideLater = () =>
    run(() => saveJobForLaterAction(row.jobId), {
      message: "Kept on Today so you can decide later.",
    });
  const markApplied = () =>
    run(() => markJobAppliedAction(row.jobId), { message: "Marked as applied." });
  const moveToToday = () =>
    run(() => saveJobForLaterAction(row.jobId), { message: "Moved back to Today." });
  const confirmReject = () =>
    run(
      async () => {
        const res = await rejectJobAction(row.jobId, rejectReason.trim());
        if (res.ok) setRejectOpen(false);
        return res;
      },
      { goTo: back.href },
    );

  const primary: ReactNode = (() => {
    if (saved) {
      return (
        <Link href={cta.href} className={buttonVariants({ className: "max-sm:flex-1" })}>
          {cta.label}
        </Link>
      );
    }
    if (state === "applied") return null;
    if (state === "rejected") {
      return (
        <Button disabled={pending} onClick={moveToToday} className="max-sm:flex-1">
          <Undo2 />
          Move back to Today
        </Button>
      );
    }
    return (
      <Button disabled={pending} onClick={save} className="max-sm:flex-1">
        <Bookmark />
        Save job
      </Button>
    );
  })();

  const actions = (
    <>
      {primary}
      <a
        href={row.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "secondary", className: "max-sm:flex-1" })}
      >
        Open posting
        <ExternalLink className="size-3.5" />
      </a>
      {state !== "rejected" && state !== "applied" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon" variant="outline" disabled={pending} aria-label="More actions" />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {saved ? (
              <DropdownMenuItem onClick={moveToToday} disabled={pending}>
                <Undo2 />
                Move back to Today
              </DropdownMenuItem>
            ) : state !== "saved" ? (
              <DropdownMenuItem onClick={decideLater} disabled={pending}>
                <Clock />
                Decide later
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={markApplied} disabled={pending}>
              <CheckCheck />
              {saved ? "Mark applied" : "Already applied"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setRejectReason("");
                setRejectOpen(true);
              }}
              disabled={pending}
            >
              <ThumbsDown />
              Not interested
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );

  return (
    <PageShell width="workspace" className="pb-28 sm:pb-12">
      <Link
        href={back.href}
        className="text-muted-foreground hover:text-foreground -mb-2 inline-flex w-fit items-center gap-1.5 rounded-md text-body-sm transition-colors duration-150"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to {back.label}
      </Link>

      {/* 1. What it is */}
      <AnimateIn as="header">
        <Surface className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <CompanyTile name={row.companyName} size="lg" />
              <div className="min-w-0 space-y-1">
                <h1 className="text-h4 text-foreground font-medium text-balance">{row.title}</h1>
                <p className="text-muted-foreground text-body">
                  {row.companyName}
                  {posted ? ` · Posted ${posted}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <ScoreBadge score={row.matchScore} kind="match" />
                  {stateLabel ? (
                    <Badge variant={stateLabel.tone} size="lg">
                      {stateLabel.label}
                    </Badge>
                  ) : null}
                  {packageLabel ? (
                    <Badge variant="secondary" size="lg">
                      {packageLabel}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="hidden shrink-0 flex-wrap items-center gap-2 sm:flex">{actions}</div>
          </div>
        </Surface>
      </AnimateIn>

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {notice ? <InlineAlert variant="success">{notice}</InlineAlert> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          {/* 2. Why it fits */}
          <DetailCard title="Why it fits you">
            <JobMatchInsights
              expanded
              enableRationaleSheet={false}
              title={row.title}
              companyName={row.companyName}
              location={row.location}
              remotePolicy={row.remotePolicy}
              remoteFit={row.remoteFit}
              remoteRequired={row.remoteRequired}
              matchingReasons={row.matchingReasons}
              concerns={row.concerns}
              mainRisk={row.mainRisk}
              missingRequirements={row.missingRequirements}
              matchDimensions={row.matchDimensions}
            />
          </DetailCard>

          {/* 3. The posting */}
          <DetailCard title="About the job">
            <JobDescription text={description} sourceUrl={row.sourceUrl} />
          </DetailCard>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:col-span-4">
          <DetailCard title="At a glance">
            <dl className="divide-y divide-border">
              <Fact label="Location" value={row.location} />
              <Fact label="Work mode" value={row.remotePolicy} />
              <Fact label="Type" value={row.employmentType} />
              <Fact label="Pay" value={row.companySnapshot.salaryText} />
              <Fact label="Posted" value={posted} />
              <Fact label="Found on" value={row.source} />
            </dl>
          </DetailCard>

          <DetailCard title="Company">
            <CompanySnapshotCard
              snapshot={row.companySnapshot}
              location={row.location}
              remotePolicy={row.remotePolicy}
              expandable={false}
            />
          </DetailCard>

          <NextStep state={state} cta={cta} />
        </aside>
      </div>

      {/* Phones: actions stay within thumb reach. */}
      <div className="bg-card/95 shadow-overlay fixed inset-x-3 bottom-3 z-20 flex items-center gap-2 rounded-full p-2 backdrop-blur-xl sm:hidden">
        {actions}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not interested</DialogTitle>
            <DialogDescription>
              Tell Optra why, so the next search leaves out jobs like this one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 pb-6 sm:px-6">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
              {REJECT_REASONS.map((reason) => (
                <Button
                  key={reason}
                  size="sm"
                  variant={rejectReason === reason ? "primary" : "outline"}
                  aria-pressed={rejectReason === reason}
                  disabled={pending}
                  onClick={() => setRejectReason(reason)}
                >
                  {reason}
                </Button>
              ))}
            </div>
            <Input
              aria-label="Or type a reason"
              placeholder="Or type a reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !rejectReason.trim()}
              onClick={confirmReject}
            >
              {pending ? "Saving…" : "Not interested"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface className="p-5 sm:p-6">
      <h2 className="text-foreground mb-4 text-h5">{title}</h2>
      {children}
    </Surface>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground text-body-sm">{label}</dt>
      <dd className="text-foreground text-right text-body-sm">{value?.trim() || "Not stated"}</dd>
    </div>
  );
}

/** One plain sentence about what to do next, matched to where the job is. */
function NextStep({ state, cta }: { state: string; cta: { href: string; label: string } }) {
  const copy: Record<string, string> = {
    interested: "Optra writes a CV and cover letter tailored to this job. You review both before anything is sent.",
    applied: "You applied. Log what happens next on Improve, so future searches get sharper.",
    rejected: "This job is hidden from Today. Move it back if you change your mind.",
  };
  const text =
    copy[state] ?? "Save it if it looks right. Then Optra helps you prepare the application.";
  return (
    <Surface className="bg-brand-wash p-5 sm:p-6">
      <h2 className="text-foreground mb-1 text-body font-medium">Next step</h2>
      <p className="text-ink-emphasis text-body-sm">{text}</p>
      {state === "interested" ? (
        <Link href={cta.href} className={buttonVariants({ size: "sm", className: "mt-4" })}>
          {cta.label}
        </Link>
      ) : state === "applied" ? (
        <Link
          href="/learning"
          className={buttonVariants({ size: "sm", variant: "secondary", className: "mt-4" })}
        >
          Log outcome
        </Link>
      ) : null}
    </Surface>
  );
}

function JobDescription({ text, sourceUrl }: { text: string; sourceUrl: string }) {
  const [showAll, setShowAll] = useState(false);
  const body = text.trim();
  if (!body) {
    return (
      <p className="text-muted-foreground text-body-sm">
        The posting didn&apos;t include a description.{" "}
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-brand-ink rounded-md underline-offset-2 hover:underline">
          Read it on the original site
        </a>
        .
      </p>
    );
  }
  const long = body.length > DESCRIPTION_PREVIEW;
  const shown = long && !showAll ? `${body.slice(0, DESCRIPTION_PREVIEW).trimEnd()}…` : body;
  return (
    <div className="space-y-3">
      <p className="text-ink-emphasis max-w-[70ch] text-body whitespace-pre-line">{shown}</p>
      {long ? (
        <Button
          size="sm"
          variant="ghost"
          className="-ml-3"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show less" : "Show full description"}
        </Button>
      ) : null}
    </div>
  );
}
