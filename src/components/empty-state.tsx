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
        "animate-enter flex flex-col items-center justify-center gap-5 px-6 py-12 text-center sm:px-8 sm:py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className="bg-subtle text-muted-foreground grid size-12 place-items-center rounded-tile in-[.bg-subtle]:bg-card"
      >
        {icon ?? <Search className="size-5" strokeWidth={1.5} />}
      </div>
      <div className="space-y-1">
        <p className="text-h5 text-foreground">
          {title}
        </p>
        <p className="text-muted-foreground mx-auto max-w-sm text-body-sm sm:text-body">
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
              "min-w-[12rem]",
            )}
          >
            {actionLabel}
          </Link>
        ) : (
          <Button
            id={actionId}
            size="lg"
            disabled={pending}
            onClick={onAction}
            className="min-w-[12rem]"
          >
            {actionLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}
