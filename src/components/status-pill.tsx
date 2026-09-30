import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { labelLeadState, labelPolicy } from "@/lib/ui-labels";

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STATE_TONE: Record<string, BadgeTone> = {
  suggested: "secondary",
  researched: "outline",
  saved_for_later: "secondary",
  accepted: "brand",
  draft_ready: "brand",
  sent: "outline",
  follow_up_due: "warn",
  replied: "brand",
  in_conversation: "brand",
  closed_won: "success",
  closed_lost: "secondary",
  rejected: "secondary",
  suppressed: "secondary",
};

export function StatePill({
  state,
  className,
}: {
  state: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        badgeVariants({ variant: STATE_TONE[state] ?? "secondary", size: "lg" }),
        className,
      )}
    >
      {labelLeadState(state)}
    </span>
  );
}

export function PolicyPill({
  policy,
  className,
}: {
  policy: string;
  className?: string;
}) {
  const blocked = policy === "blocked";
  return (
    <span
      className={cn(
        badgeVariants({ variant: blocked ? "destructive" : "ghost", size: "lg" }),
        className,
      )}
    >
      {labelPolicy(policy)}
    </span>
  );
}

export function ScoreMark({
  score,
  className,
}: {
  score: number | null | undefined;
  className?: string;
}) {
  if (score == null) {
    return (
      <span className={cn("tabular text-muted-foreground text-base", className)}>
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "tabular text-foreground text-h4 font-medium",
        className,
      )}
      aria-label={`Score ${score}`}
    >
      {score}
    </span>
  );
}
