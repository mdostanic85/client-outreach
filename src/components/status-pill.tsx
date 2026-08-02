import { cn } from "@/lib/utils";
import { labelLeadState, labelPolicy } from "@/lib/ui-labels";

const STATE_TONE: Record<string, string> = {
  suggested: "bg-white/6 text-muted-foreground",
  researched: "bg-white/8 text-[var(--card-foreground)]",
  saved_for_later: "bg-secondary text-secondary-foreground",
  accepted: "bg-accent-wash text-primary",
  draft_ready: "bg-accent-wash text-primary",
  sent: "bg-secondary text-[var(--card-foreground)]",
  follow_up_due: "bg-[#2a1f0a] text-warn",
  replied: "bg-accent-wash text-primary",
  in_conversation: "bg-accent-wash text-primary",
  closed_won: "bg-accent-wash text-primary",
  closed_lost: "bg-white/6 text-muted-foreground",
  rejected: "bg-white/6 text-muted-foreground",
  suppressed: "bg-white/6 text-muted-foreground",
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
        "inline-flex items-center rounded-lg px-2.5 py-1.5 text-[15px] font-medium transition-colors duration-150 ease-[var(--ease-out-soft)]",
        STATE_TONE[state] ?? "bg-white/6 text-muted-foreground",
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
        "inline-flex items-center rounded-lg px-2.5 py-1.5 text-[15px]",
        blocked
          ? "bg-destructive/15 text-destructive"
          : "text-muted-foreground",
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
        "font-display tabular text-[var(--card-foreground)] text-[24px] font-semibold tracking-tight",
        className,
      )}
      aria-label={`Score ${score}`}
    >
      {score}
    </span>
  );
}
