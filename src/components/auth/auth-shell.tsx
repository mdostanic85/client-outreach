import Link from "next/link";
import type { ReactNode } from "react";
import { MakerCredit } from "@/components/maker-credit";
import { noWidow } from "@/lib/utils";

export function AuthBrand() {
  return (
    <Link href="/welcome" className="inline-flex items-center gap-2.5">
      <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg text-sm font-bold tracking-tight">
        O
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight text-[var(--card-foreground)]">
        Optra
      </span>
    </Link>
  );
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
    <div className="bg-background flex min-h-svh w-full flex-col lg:flex-row">
      <div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-[44%] lg:max-w-xl lg:px-14">
        <AuthBrand />
        <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-[14px]">
            {noWidow(
              "Explained matches · private shortlist · you approve every move",
            )}
          </p>
          <MakerCredit />
        </div>
      </div>
      <aside className="border-border relative min-h-[28rem] overflow-x-hidden overflow-y-auto border-t lg:min-h-svh lg:flex-1 lg:border-t-0 lg:border-l">
        {panel}
      </aside>
    </div>
  );
}
