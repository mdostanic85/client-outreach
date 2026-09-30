import type { ReactNode } from "react";
import { MakerCredit } from "@/components/maker-credit";
import { OptraLogo } from "@/components/optra-logo";
import { cn, noWidow } from "@/lib/utils";

export function AuthBrand({ width = 120 }: { width?: number }) {
  return <OptraLogo href="/welcome" width={width} />;
}

/**
 * Public-page header: the wordmark sits on the page's center line; the one
 * action (if any) hangs off the right edge. Equal side columns keep the logo
 * centered whether or not there is an action.
 */
export function AuthHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-8 sm:py-5">
      <span aria-hidden />
      <AuthBrand />
      <div className="flex justify-end">{action}</div>
    </header>
  );
}

/**
 * Auth frame: the wordmark and one white card, centered together as a single
 * group, over the page tint, with a quiet footer. No header links: every card
 * already links to the other auth screen, so a corner "Log in" would repeat it.
 */
export function AuthShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-background flex min-h-svh w-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pt-10 pb-6 sm:gap-10 sm:px-6 sm:pt-16">
        <AuthBrand width={128} />
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
