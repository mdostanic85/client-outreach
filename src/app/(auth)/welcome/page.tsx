import Link from "next/link";
import { AuthBrand } from "@/components/auth/auth-shell";
import { ensureDb } from "@/db/ensure";
import { noWidow } from "@/lib/utils";
import { countUsers } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

/**
 * First screen: explain the product before auth.
 * Pattern: Contra value prop + Canny/Pin Get Started + Log in (Mobbin).
 */
export default function WelcomePage() {
  ensureDb();
  const hasUsers = countUsers() > 0;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -10%, color-mix(in oklch, var(--primary) 22%, transparent), transparent), radial-gradient(ellipse 50% 40% at 100% 60%, color-mix(in oklch, var(--accent-foreground) 10%, transparent), transparent), linear-gradient(180deg, #0c1018 0%, #0a0c11 55%, #0b1412 100%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <AuthBrand />
        {hasUsers ? (
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground text-[14px] font-medium transition-colors"
          >
            Log in
          </Link>
        ) : null}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <p className="text-primary mb-5 text-[15px] font-medium tracking-[0.14em] uppercase">
          Private job shortlist
        </p>
        <h1 className="font-display text-[clamp(2.1rem,5vw,3.25rem)] leading-[1.08] font-semibold tracking-tight text-[var(--card-foreground)]">
          Fewer listings.{" "}
          <span className="text-primary">Clearer reasons</span> to apply.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-xl text-[16px] leading-relaxed sm:text-[17px]">
          {noWidow(
            "Optra builds a grounded view of your work from your CV, LinkedIn, portfolio, and notes. Each day you get a short list of openings, with why they fit and what to check before you apply. You approve every move.",
          )}
        </p>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-11 min-w-[180px] items-center justify-center rounded-lg px-4 text-[15px] font-medium transition-colors"
          >
            {hasUsers ? "Create account" : "Get started"}
          </Link>
          <Link
            href="/login"
            className="border-border bg-background hover:bg-muted inline-flex h-11 min-w-[180px] items-center justify-center rounded-lg border px-4 text-[15px] font-medium transition-colors"
          >
            Log in
          </Link>
        </div>

        <div className="border-border bg-card/60 mt-14 grid w-full max-w-2xl gap-px overflow-hidden rounded-2xl border text-left sm:grid-cols-3">
          {[
            {
              title: noWidow("Grounded in your work"),
              body: noWidow(
                "From your CV, LinkedIn, portfolio, and notes. Not a generic bio.",
              ),
            },
            {
              title: noWidow("Explained matches"),
              body: noWidow(
                "Every role includes a score, clear reasons, and caveats.",
              ),
            },
            {
              title: noWidow("You stay in control"),
              body: noWidow(
                "Review and decide on your terms. Nothing applies or sends itself.",
              ),
            },
          ].map((item) => (
            <div key={item.title} className="bg-background/80 px-5 py-5">
              <p className="font-display text-[15px] font-semibold text-[var(--card-foreground)]">
                {item.title}
              </p>
              <p className="text-muted-foreground mt-1.5 text-[15px] leading-snug">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
