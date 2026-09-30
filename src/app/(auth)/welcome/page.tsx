import Link from "next/link";
import { AuthBrand } from "@/components/auth/auth-shell";
import { MakerCredit } from "@/components/maker-credit";
import { noWidow } from "@/lib/utils";

const STEPS = [
  {
    n: "1",
    title: "Tell it about your work",
    body: "Upload your CV and answer a few questions: the job you want, where, and what you need to be paid.",
  },
  {
    n: "2",
    title: "Get a short list",
    body: "Each day you see a handful of openings. Not a whole job board.",
  },
  {
    n: "3",
    title: "You decide",
    body: "Each job says why it fits and what to double-check. You mark it, save it, or skip it. Nothing is sent for you.",
  },
] as const;

/** Public first screen. Signed-out visitors always land here. */
export default function WelcomePage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -8%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 70%), linear-gradient(180deg, #0c1018 0%, #0a0c11 48%, #0b1412 100%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <AuthBrand />
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground text-[15px] font-medium transition-colors"
        >
          Log in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-primary mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
          For anyone looking for work
        </p>
        <h1 className="font-display max-w-[16ch] text-[clamp(2.4rem,6vw,3.6rem)] leading-[1.05] font-semibold tracking-tight text-[var(--card-foreground)]">
          A few jobs that fit you.{" "}
          <span className="text-primary">In plain words.</span>
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-[17px] leading-relaxed sm:text-[18px]">
          {noWidow(
            "Optra reads your CV, looks through job listings, and brings back a short list. Every job comes with why it fits and what to check before you spend time on it.",
          )}
        </p>

        <ol className="mt-12 w-full max-w-md text-left">
          {STEPS.map((step, index) => (
            <li key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold">
                  {step.n}
                </span>
                {index < STEPS.length - 1 ? (
                  <span className="bg-primary/35 my-1.5 w-px flex-1" aria-hidden />
                ) : null}
              </div>
              <div className={index < STEPS.length - 1 ? "pb-7" : ""}>
                <p className="font-display pt-1 text-[17px] font-semibold text-[var(--card-foreground)]">
                  {step.title}
                </p>
                <p className="text-muted-foreground mt-1.5 text-[15px] leading-relaxed">
                  {noWidow(step.body)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground hover:bg-primary/85 inline-flex h-14 items-center justify-center rounded-xl px-5 text-[16px] font-medium transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="border-white/25 bg-secondary text-foreground hover:border-white/45 inline-flex h-14 items-center justify-center rounded-xl border-2 px-5 text-[16px] font-medium transition-colors"
          >
            I already have an account
          </Link>
        </div>
      </main>

      <footer className="relative z-10 px-6 pb-8 sm:px-10">
        <MakerCredit align="center" />
      </footer>
    </div>
  );
}
