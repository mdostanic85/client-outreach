import Link from "next/link";
import type { ReactNode } from "react";
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

/** Split layout: form left, product explainer right (Clay / Greptile pattern). */
export function AuthShell({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-svh w-full">
      <div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-[44%] lg:max-w-xl lg:px-14">
        <AuthBrand />
        <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-muted-foreground text-[14px]">
          {noWidow(
            "Explained matches · private shortlist · you approve every move",
          )}
        </p>
      </div>
      <aside className="border-border relative hidden overflow-hidden border-l lg:flex lg:flex-1">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 10%, color-mix(in oklch, var(--primary) 28%, transparent), transparent), radial-gradient(ellipse 70% 50% at 90% 80%, color-mix(in oklch, var(--accent-foreground) 12%, transparent), transparent), linear-gradient(165deg, #0d1219 0%, #0a0c11 45%, #0f1a18 100%)",
          }}
        />
        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          {panel}
        </div>
      </aside>
    </div>
  );
}
