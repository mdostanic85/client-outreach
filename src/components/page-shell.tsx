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
        "animate-enter mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:px-12 lg:py-14",
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
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:pb-6">
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
        <h1 className="font-display text-[28px] leading-[33px] font-semibold tracking-[-0.7px] break-words sm:text-[34px] sm:leading-[39px] sm:tracking-[-0.85px] text-balance text-[var(--card-foreground)]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground text-[15px] leading-[1.6] sm:text-[17px] sm:leading-[1.625]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3 pb-2 sm:shrink-0 sm:gap-4 sm:pt-1 sm:pb-0">
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
        "bg-card border-border overflow-hidden rounded-[18px] border",
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
        "border-border flex flex-wrap items-center gap-4 border-b px-5 py-5 sm:px-8 sm:py-6",
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
    <div className={cn("space-y-6 px-5 py-6 sm:px-8 sm:py-8", className)}>{children}</div>
  );
}
