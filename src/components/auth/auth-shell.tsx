import type { ReactNode } from "react";
import { MakerCredit } from "@/components/maker-credit";
import { OptraLogo } from "@/components/optra-logo";
import { cn, noWidow } from "@/lib/utils";

export function AuthBrand() {
  return <OptraLogo href="/welcome" width={92} />;
}

/**
 * Auth frame: the page tint, a slim header, one centered white card and a
 * quiet footer. The card reveals once on first load.
 */
export function AuthShell({
  children,
  headerAction,
  className,
}: {
  children: ReactNode;
  /** Right side of the header, e.g. a link to the other auth screen. */
  headerAction?: ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-background flex min-h-svh w-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-5">
        <AuthBrand />
        {headerAction}
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div
          className={cn(
            "animate-enter bg-card w-full max-w-md rounded-card p-6 sm:p-8 shadow-card",
            className,
          )}
        >
          {children}
        </div>
      </main>
      <footer className="flex shrink-0 flex-col items-center gap-1 px-4 py-5 text-center">
        <p className="text-muted-foreground text-body-sm">
          {noWidow("A short list of jobs. You decide what happens next.")}
        </p>
        <MakerCredit align="center" />
      </footer>
    </div>
  );
}

/** Title + one line of support at the top of an auth card. */
export function AuthHeading({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-h4 text-foreground font-medium">{title}</h1>
      {description ? (
        <p className="text-muted-foreground text-body-sm">{description}</p>
      ) : null}
    </div>
  );
}
