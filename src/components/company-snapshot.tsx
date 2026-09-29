"use client";

import { useState, type ReactNode } from "react";
import {
  Building2,
  ExternalLink,
  MapPin,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  formatHeadcountBand,
  formatHiringActivity,
  reputationTone,
  websiteHref,
  type CompanySnapshot,
} from "@/modules/jobs/company-snapshot";

function FactRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-[14px]">
      <dt className="text-muted-foreground flex shrink-0 items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-medium leading-snug">{value}</dd>
    </div>
  );
}

function ReputationChip({
  rating,
  reviewCount,
  source,
}: {
  rating: number;
  reviewCount: number;
  source: string;
}) {
  const tone = reputationTone(rating, reviewCount);
  const display = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[13px] font-medium tabular-nums ring-1",
        tone === "good" &&
          "bg-primary/12 text-primary ring-primary/25",
        tone === "mixed" &&
          "bg-amber-500/12 text-amber-900 ring-amber-500/25 dark:text-amber-100",
        tone === "poor" &&
          "bg-destructive/12 text-destructive ring-destructive/25",
        tone === "insufficient" &&
          "bg-muted text-muted-foreground ring-border",
      )}
      title={
        tone === "insufficient"
          ? `Too few reviews (${reviewCount}) for a reliable signal`
          : `${source} · ${reviewCount} reviews`
      }
    >
      <Star className="size-3 fill-current opacity-80" />
      {display}
      <span className="font-normal opacity-70">· {reviewCount}</span>
    </span>
  );
}

function CompanyFacts({
  snapshot,
  location,
  dense,
  showWebsite = true,
}: {
  snapshot: CompanySnapshot;
  location: string | null;
  dense?: boolean;
  showWebsite?: boolean;
}) {
  const locationValue = [location?.trim(), snapshot.country?.trim()]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(" · ");
  const size = formatHeadcountBand(snapshot.headcountBand);
  const hiring = formatHiringActivity(
    snapshot.relatedOpenings,
    snapshot.hiringLookbackDays,
  );
  const site = websiteHref(snapshot.domain);

  const rows: { label: string; value: string; icon: ReactNode }[] = [];
  if (snapshot.salaryText) {
    rows.push({
      label: "Pay",
      value: snapshot.salaryText,
      icon: <Wallet className="size-3.5 opacity-70" />,
    });
  }
  if (locationValue) {
    rows.push({
      label: "Location",
      value: locationValue,
      icon: <MapPin className="size-3.5 opacity-70" />,
    });
  }
  if (size) {
    rows.push({
      label: "Size",
      value: size,
      icon: <Users className="size-3.5 opacity-70" />,
    });
  }
  if (hiring) {
    rows.push({
      label: "Hiring",
      value: hiring,
      icon: <Building2 className="size-3.5 opacity-70" />,
    });
  }

  if (rows.length === 0 && !site && !snapshot.summary) {
    return (
      <p className="text-muted-foreground text-[14px] leading-snug">
        No public company details yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", dense && "space-y-2.5")}>
      {snapshot.summary ? (
        <p className="text-[14px] leading-relaxed text-pretty">
          {snapshot.summary}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <dl className="space-y-2">
          {rows.map((row) => (
            <FactRow
              key={row.label}
              label={row.label}
              value={row.value}
              icon={row.icon}
            />
          ))}
        </dl>
      ) : null}

      {showWebsite && site ? (
        <a
          href={site}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex items-center gap-1.5 text-[14px] font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Visit website
          <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function CompanyDetailSheet({
  open,
  onOpenChange,
  snapshot,
  location,
  remotePolicy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: CompanySnapshot;
  location: string | null;
  remotePolicy: string | null;
}) {
  const site = websiteHref(snapshot.domain);
  const size = formatHeadcountBand(snapshot.headcountBand);
  const hiring = formatHiringActivity(
    snapshot.relatedOpenings,
    snapshot.hiringLookbackDays,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="border-b">
          <SheetTitle className="pr-8 text-[18px] leading-snug">
            {snapshot.companyName}
          </SheetTitle>
          <SheetDescription>
            Company snapshot for this role
            {remotePolicy ? ` · ${remotePolicy}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {snapshot.reputation ? (
            <div className="flex flex-wrap items-center gap-2">
              <ReputationChip
                rating={snapshot.reputation.rating}
                reviewCount={snapshot.reputation.reviewCount}
                source={snapshot.reputation.source}
              />
              <span className="text-muted-foreground text-[13px]">
                via {snapshot.reputation.source}
                {snapshot.reputation.reviewCount < 10
                  ? " · limited sample"
                  : ""}
              </span>
              {snapshot.reputation.sourceUrl ? (
                <a
                  href={snapshot.reputation.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
                >
                  Reviews
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          ) : null}

          <CompanyFacts
            snapshot={snapshot}
            location={location}
            showWebsite={false}
          />

          <dl className="text-muted-foreground space-y-2 border-t pt-4 text-[14px]">
            {!snapshot.salaryText ? (
              <FactRow label="Pay" value="Not listed on posting" />
            ) : null}
            {!size ? <FactRow label="Size" value="Unknown" /> : null}
            {!hiring ? (
              <FactRow label="Recent hiring" value="No recent openings tracked" />
            ) : null}
            {!snapshot.reputation ? (
              <FactRow label="Employee reviews" value="No public rating yet" />
            ) : null}
          </dl>

          {snapshot.risksAndUnknowns.length > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-2 text-[14px] font-medium">
                Open questions
              </h3>
              <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-[14px] leading-snug">
                {snapshot.risksAndUnknowns.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {site ? (
            <a
              href={site}
              target="_blank"
              rel="noreferrer"
              className="border-border hover:bg-muted inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-[14px]"
            >
              Visit website
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Compact company block for expanded job cards.
 * Pattern: Upwork “About the client” + Contra “About company” — facts only, no dashboard.
 */
export function CompanySnapshotCard({
  snapshot,
  location,
  remotePolicy,
  /** When false, show full facts inline (no nested “More” sheet). */
  expandable = true,
}: {
  snapshot: CompanySnapshot;
  location: string | null;
  remotePolicy: string | null;
  expandable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasAnything =
    Boolean(snapshot.summary) ||
    Boolean(snapshot.salaryText) ||
    Boolean(snapshot.domain) ||
    Boolean(location) ||
    Boolean(snapshot.country) ||
    Boolean(snapshot.headcountBand) ||
    snapshot.relatedOpenings > 0 ||
    Boolean(snapshot.reputation) ||
    snapshot.risksAndUnknowns.length > 0;

  if (!hasAnything) {
    return (
      <p className="text-muted-foreground text-[14px] leading-snug">
        No public company details yet.
      </p>
    );
  }

  if (!expandable) {
    const size = formatHeadcountBand(snapshot.headcountBand);
    const hiring = formatHiringActivity(
      snapshot.relatedOpenings,
      snapshot.hiringLookbackDays,
    );
    const site = websiteHref(snapshot.domain);

    return (
      <div className="space-y-5">
        {snapshot.reputation ? (
          <div className="flex flex-wrap items-center gap-2">
            <ReputationChip
              rating={snapshot.reputation.rating}
              reviewCount={snapshot.reputation.reviewCount}
              source={snapshot.reputation.source}
            />
            <span className="text-muted-foreground text-[13px]">
              via {snapshot.reputation.source}
              {snapshot.reputation.reviewCount < 10
                ? " · limited sample"
                : ""}
            </span>
            {snapshot.reputation.sourceUrl ? (
              <a
                href={snapshot.reputation.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
              >
                Reviews
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        ) : null}

        <CompanyFacts snapshot={snapshot} location={location} showWebsite={false} />

        <dl className="text-muted-foreground space-y-2 border-t pt-4 text-[14px]">
          {!snapshot.salaryText ? (
            <FactRow label="Pay" value="Not listed on posting" />
          ) : null}
          {!size ? <FactRow label="Size" value="Unknown" /> : null}
          {!hiring ? (
            <FactRow label="Recent hiring" value="No recent openings tracked" />
          ) : null}
          {!snapshot.reputation ? (
            <FactRow label="Employee reviews" value="No public rating yet" />
          ) : null}
          {remotePolicy?.trim() ? (
            <FactRow label="Remote policy" value={remotePolicy.trim()} />
          ) : null}
        </dl>

        {snapshot.risksAndUnknowns.length > 0 ? (
          <section>
            <h3 className="text-muted-foreground mb-2 text-[14px] font-medium">
              Open questions
            </h3>
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-[14px] leading-snug">
              {snapshot.risksAndUnknowns.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {site ? (
          <a
            href={site}
            target="_blank"
            rel="noreferrer"
            className="border-border hover:bg-muted inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 text-[14px]"
          >
            Visit website
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <section className="rounded-xl bg-muted/40 px-3.5 py-3 ring-1 ring-border/60">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-muted-foreground text-[14px] font-medium">
              About {snapshot.companyName}
            </p>
            {snapshot.reputation ? (
              <ReputationChip
                rating={snapshot.reputation.rating}
                reviewCount={snapshot.reputation.reviewCount}
                source={snapshot.reputation.source}
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="text-primary shrink-0 text-[13px] font-medium hover:underline"
          >
            More
          </button>
        </div>
        <CompanyFacts snapshot={snapshot} location={location} dense />
      </section>

      <CompanyDetailSheet
        open={open}
        onOpenChange={setOpen}
        snapshot={snapshot}
        location={location}
        remotePolicy={remotePolicy}
      />
    </>
  );
}
