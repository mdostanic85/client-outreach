import Link from "next/link";
import { AuthBrand } from "@/components/auth/auth-shell";
import { MakerCredit } from "@/components/maker-credit";
import { noWidow } from "@/lib/utils";

const FACTS = [
  { n: "1", title: "Your CV", body: "We read your work." },
  { n: "2", title: "A short list", body: "A few jobs a day." },
  { n: "3", title: "You decide", body: "Nothing is sent for you." },
] as const;

/** Public first screen. Fits one viewport: purpose on the left, the path on the right. */
export default function WelcomePage() {
  return (
    <div className="relative flex h-svh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 18% 40%, color-mix(in oklch, var(--brand) 22%, transparent), transparent 68%), linear-gradient(180deg, #0c1018 0%, #0a0c11 55%, #0b1412 100%)",
        }}
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-6 py-4 sm:px-10">
        <AuthBrand />
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground text-[15px] font-medium transition-colors"
        >
          Log in
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid min-h-0 w-full max-w-5xl min-w-0 flex-1 items-center gap-6 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-10">
        <div className="min-w-0 text-center lg:text-left">
          <p className="text-brand-ink text-[12px] font-medium tracking-[0.16em] uppercase">
            For anyone looking for work
          </p>
          <h1 className="mt-3 text-[1.7rem] leading-[1.08] font-medium tracking-tight text-balance text-foreground sm:text-[clamp(2rem,4vw,3.25rem)]">
            A few jobs that fit you.{" "}
            <span className="text-brand-ink">In plain words.</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-md text-[16px] leading-snug lg:mx-0">
            {noWidow(
              "Optra reads your CV, looks through listings, and shows why each job fits.",
            )}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:max-w-md">
            <Link
              href="/signup"
              className="bg-primary text-primary-foreground hover:bg-primary/85 inline-flex h-12 flex-1 items-center justify-center rounded-xl px-5 text-[16px] font-medium transition-colors"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="border-white/25 bg-secondary text-foreground hover:border-white/45 inline-flex h-12 flex-1 items-center justify-center rounded-xl border-2 px-5 text-[16px] font-medium transition-colors"
            >
              I have an account
            </Link>
          </div>
        </div>

        <ol className="border-white/15 bg-card/70 min-w-0 divide-y divide-white/10 rounded-2xl border">
          {FACTS.map((fact) => (
            <li key={fact.n} className="flex items-center gap-3 px-4 py-3 text-left sm:px-5 sm:py-4">
              <span className="bg-brand text-white flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-medium">
                {fact.n}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-foreground sm:text-[16px]">
                  {fact.title}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[12px] leading-snug sm:text-[14px]">
                  {fact.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </main>

      <footer className="relative z-10 shrink-0 px-6 py-3 sm:px-10">
        <MakerCredit align="center" />
      </footer>
    </div>
  );
}
