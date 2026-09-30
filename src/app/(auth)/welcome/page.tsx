import Link from "next/link";
import { AuthBrand } from "@/components/auth/auth-shell";
import { MakerCredit } from "@/components/maker-credit";
import { AnimateIn } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { CapsuleLabel } from "@/components/ui/capsule-label";
import { noWidow } from "@/lib/utils";

const FACTS = [
  { n: "1", title: "Your CV", body: "We read your work." },
  { n: "2", title: "A short list", body: "A few jobs a day." },
  { n: "3", title: "You decide", body: "Nothing is sent for you." },
] as const;

/** Public first screen. Fits one viewport: purpose on the left, the path on the right. */
export default function WelcomePage() {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-5">
        <AuthBrand />
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Log in
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1290px] min-w-0 flex-1 items-center gap-8 px-4 py-8 sm:px-5 lg:grid-cols-12 lg:gap-4 lg:px-8">
        <AnimateIn className="min-w-0 text-center lg:col-span-7 lg:text-left">
          <span className="bg-card text-ink-emphasis inline-flex h-7 items-center gap-2 rounded-full border border-border-strong pr-3 pl-1 text-caption">
            <span aria-hidden className="bg-brand size-5 rounded-full" />
            For anyone looking for work
          </span>
          <h1 className="text-h3 sm:text-h2 md:text-h1 mt-5 font-medium text-balance text-foreground">
            A few jobs that fit you.{" "}
            <span className="text-brand-ink">In plain words.</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-md text-body sm:text-body-lg lg:mx-0">
            {noWidow(
              "Optra reads your CV, looks through listings, and shows why each job fits.",
            )}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/signup"
              className={buttonVariants({ variant: "capsule", className: "max-sm:w-full" })}
            >
              <CapsuleLabel className="max-sm:w-full max-sm:justify-between">
                Get started
              </CapsuleLabel>
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "secondary", size: "lg", className: "max-sm:w-full" })}
            >
              I have an account
            </Link>
          </div>
        </AnimateIn>

        <ol className="bg-card min-w-0 divide-y divide-border rounded-card lg:col-span-5">
          {FACTS.map((fact) => (
            <li key={fact.n} className="flex items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5">
              <span className="bg-brand-wash text-brand-ink flex size-10 shrink-0 items-center justify-center rounded-full text-body tabular">
                {fact.n}
              </span>
              <span className="min-w-0">
                <span className="text-foreground block text-body sm:text-body-lg">
                  {fact.title}
                </span>
                <span className="text-muted-foreground block text-body-sm">
                  {fact.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </main>

      <footer className="shrink-0 px-4 py-5 sm:px-8">
        <MakerCredit align="center" />
      </footer>
    </div>
  );
}
