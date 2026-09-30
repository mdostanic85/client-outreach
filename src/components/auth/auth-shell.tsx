import type { ReactNode } from "react";
import { MakerCredit } from "@/components/maker-credit";
import { OptraLogo } from "@/components/optra-logo";
import { noWidow } from "@/lib/utils";

export function AuthBrand() {
  return <OptraLogo href="/welcome" width={100} />;
}

/** Split layout: form left, product preview right (stacks below form on mobile). */
export function AuthShell({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className="bg-background flex h-svh w-full overflow-hidden">
      <div className="flex min-h-0 w-full flex-col px-6 py-4 sm:px-10 lg:w-[44%] lg:max-w-xl lg:px-14">
        <AuthBrand />
        <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
        <div className="shrink-0 space-y-1 pt-3">
          <p className="text-muted-foreground text-[13px] leading-snug">
            {noWidow("A short list of jobs. You decide what happens next.")}
          </p>
          <MakerCredit />
        </div>
      </div>
      <aside className="hidden h-full min-h-0 overflow-hidden border-l border-white/10 lg:block lg:flex-1">
        {panel}
      </aside>
    </div>
  );
}
