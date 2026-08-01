import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  pending,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-8 py-20 text-center">
      <div
        aria-hidden
        className="border-border from-accent-wash/80 to-white/5 h-20 w-full max-w-sm rounded-2xl border border-dashed bg-linear-to-br"
      />
      <div className="space-y-3">
        <p className="font-display text-[20px] font-semibold text-[var(--card-foreground)]">
          {title}
        </p>
        <p className="text-muted-foreground max-w-md text-[15px] leading-relaxed">
          {description}
        </p>
      </div>
      {actionLabel && onAction ? (
        <Button size="lg" disabled={pending} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
