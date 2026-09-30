import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Page container: 1290px max, 20px gutter (16px below 640). Only the page
 * header reveals on first load; content renders settled.
 */
export function PageShell({
  children,
  className,
  width = "wide",
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * wide — triage/lists (Today, Queue, Analytics)
   * workspace / setup / lead — Setup nav + detail (same max width)
   * form — auth / short single-purpose forms only
   */
  width?: "wide" | "workspace" | "setup" | "form" | "lead";
}) {
  const isWorkspace =
    width === "workspace" || width === "setup" || width === "lead";

  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-4 pb-12 sm:gap-8 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8",
        width === "wide" && "max-w-[1290px]",
        isWorkspace && "max-w-[1152px]",
        width === "form" && "max-w-2xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

/** 12-column grid with a 16px gap for tile layouts (single column on phones). */
export function PageGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-12", className)}>
      {children}
    </div>
  );
}

/**
 * Split header: title + description left, context chip + actions right.
 * Stacks on phones. `meta` given as text renders as the context chip.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  const chip =
    typeof meta === "string" || typeof meta === "number" ? (
      <span className={badgeVariants({ variant: "outline", size: "lg" })}>{meta}</span>
    ) : (
      meta
    );
  return (
    <header className="animate-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {breadcrumb ? (
          <div className="text-muted-foreground mb-1 text-body-sm">{breadcrumb}</div>
        ) : null}
        <h1 className="text-h4 text-foreground font-medium break-words text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-body-sm sm:text-body">
            {description}
          </p>
        ) : null}
      </div>
      {chip || actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {chip}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function SectionTitle({
  title,
  description,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-h5 text-foreground">{title}</h2>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-body-sm">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="text-muted-foreground text-body-sm">{meta}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** White 20px card on the page tint. No border, no shadow. */
export function Surface({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Surface change on hover — for standalone clickable cards only */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-card shadow-card",
        interactive && "interactive-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center gap-4 border-b px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6 px-4 py-5 sm:px-6 sm:py-6", className)}>{children}</div>
  );
}
