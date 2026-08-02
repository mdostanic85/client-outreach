import { cn } from "@/lib/utils";

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
        "animate-enter mx-auto flex w-full flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:gap-8 lg:px-12 lg:py-14",
        width === "wide" && "max-w-[1320px]",
        isWorkspace && "max-w-6xl",
        width === "form" && "max-w-2xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

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
  return (
    <header className="border-border flex flex-wrap items-start justify-between gap-6 border-b pb-8">
      <div className="min-w-0 max-w-3xl space-y-4">
        {breadcrumb ? (
          <div className="text-muted-foreground text-[13px] font-medium tracking-wide">
            {breadcrumb}
          </div>
        ) : null}
        {meta ? (
          <div className="text-muted-foreground text-[15px] font-medium tracking-wide">
            {meta}
          </div>
        ) : null}
        <h1 className="font-display text-[34px] leading-[1.15] font-semibold tracking-tight text-balance text-[var(--card-foreground)]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-[17px] leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-4 pt-1">
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
      <div className="min-w-0 space-y-2">
        <h2 className="font-display text-[20px] leading-snug font-semibold tracking-tight text-[var(--card-foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="text-muted-foreground text-[15px]">{meta}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}

export function Surface({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Subtle lift on hover — use for standalone cards, not nested list shells */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card border-border overflow-hidden rounded-[18px] border shadow-[var(--shadow-card)]",
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
        "border-border flex flex-wrap items-center gap-4 border-b px-8 py-6",
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
    <div className={cn("space-y-6 px-8 py-8", className)}>{children}</div>
  );
}
