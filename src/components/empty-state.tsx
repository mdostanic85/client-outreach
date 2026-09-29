import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  pending,
  actionId,
  icon,
  className,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  pending?: boolean;
  actionId?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const showAction = Boolean(actionLabel && (onAction || actionHref));

  return (
    <div
      className={cn(
        "animate-enter-scale flex flex-col items-center justify-center gap-5 px-6 py-14 text-center sm:px-8 sm:py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className="border-border bg-muted/40 text-muted-foreground empty-float grid size-14 place-items-center rounded-2xl border"
      >
        {icon ?? <Search className="size-6 opacity-70" strokeWidth={1.5} />}
      </div>
      <div className="animate-enter space-y-2" style={{ animationDelay: "60ms" }}>
        <p className="font-display text-[18px] font-semibold text-[var(--card-foreground)] sm:text-[20px]">
          {title}
        </p>
        <p className="text-muted-foreground mx-auto max-w-sm text-[14px] leading-relaxed sm:text-[15px]">
          {description}
        </p>
      </div>
      {showAction ? (
        actionHref ? (
          <Link
            id={actionId}
            href={actionHref}
            className={cn(
              buttonVariants({ size: "lg" }),
              "pressable animate-enter h-12 min-w-[12rem] rounded-xl px-6 text-[16px]",
            )}
            style={{ animationDelay: "120ms" }}
          >
            {actionLabel}
          </Link>
        ) : (
          <Button
            id={actionId}
            size="lg"
            disabled={pending}
            onClick={onAction}
            className="animate-enter h-12 min-w-[12rem] rounded-xl px-6 text-[16px]"
            style={{ animationDelay: "120ms" }}
          >
            {actionLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}
