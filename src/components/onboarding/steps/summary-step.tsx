"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProfileSummary } from "@/modules/onboarding/survey-core";
import { roleWithLevel } from "@/modules/profile/schemas";
import { PrimaryButton, Screen } from "@/components/onboarding/ui";

export function SummaryStep({
  summary,
  pending,
  error,
  onEdit,
  onConfirm,
}: {
  summary: ProfileSummary;
  pending: boolean;
  error: string | null;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const where = summary.where
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const rows: Array<{ label: string; value?: string | null; chips?: string[] }> = [
    { label: "Role", value: roleWithLevel(summary.level, summary.role) || null },
    { label: "Experience", value: summary.years ? `${summary.years} years` : null },
    { label: "Strongest skills", chips: summary.skills },
    { label: "Licences", chips: summary.licenses },
    { label: "Where", chips: where },
    { label: "Minimum pay", value: summary.pay },
  ];
  const visible = rows.filter((row) => row.value || row.chips?.length);

  return (
    <Screen title="Here's what we understood" hint="We'll search for roles based on this. You can change it anytime on your Profile.">
      <dl className="mx-auto w-full max-w-2xl text-left">
        {visible.map((row, index) => (
          <div
            key={row.label}
            className={cn(
              "grid grid-cols-1 gap-2 py-5 sm:grid-cols-[11rem_1fr] sm:items-start sm:gap-8",
              index > 0 && "border-t border-border",
            )}
          >
            <dt className="text-muted-foreground text-body-sm sm:pt-1.5 sm:text-right">
              {row.label}
            </dt>
            <dd>
              {row.chips?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {row.chips.map((chip) => (
                    <li
                      key={chip}
                      className="bg-card text-foreground rounded-full border border-border-strong px-3.5 py-1.5 text-body-sm"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-lg leading-snug text-foreground">{row.value}</p>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {error ? (
        <p role="alert" className="text-destructive mt-4 text-body">
          {error}
        </p>
      ) : null}
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
        <PrimaryButton className="sm:mx-0 sm:w-56" pending={pending} onClick={onConfirm}>
          {pending ? "Setting up your search…" : "Looks right"}
        </PrimaryButton>
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Change answers
        </button>
      </div>
    </Screen>
  );
}
