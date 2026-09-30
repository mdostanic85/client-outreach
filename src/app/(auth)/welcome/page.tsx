import Image from "next/image";
import Link from "next/link";
import { AuthBrand } from "@/components/auth/auth-shell";
import { MakerCredit } from "@/components/maker-credit";
import { AnimateIn } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { CapsuleLabel } from "@/components/ui/capsule-label";
import { noWidow } from "@/lib/utils";

const STEPS = [
  {
    title: "Add your CV",
    body: "We read the work you have already done.",
  },
  {
    title: "See a short list",
    body: "A few open jobs, each with a plain reason it fits.",
  },
  {
    title: "You decide",
    body: "Nothing is applied for or sent unless you do it.",
  },
] as const;

function HeroPhoto({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Image
        src="/welcome-hero.jpg"
        alt="A person at a wooden desk by a window, reading on a laptop."
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover object-[center_30%]"
      />
    </div>
  );
}

/**
 * Public first screen. The sentence says what Optra does; the photo is the
 * other half. The wordmark opens the text column (same left edge as the
 * headline) instead of floating in a corner, and there is no corner "Log in":
 * "I have an account" sits right next to the primary action.
 */
export default function WelcomePage() {
  return (
    <div className="bg-background box-border w-full max-w-[100vw] overflow-x-clip lg:grid lg:min-h-svh lg:grid-cols-2">
      <div className="flex min-h-svh min-w-0 flex-col">
        <main className="box-border flex min-w-0 flex-1 flex-col px-5 pt-8 pb-6 sm:px-10 sm:pt-12 lg:justify-center lg:px-14 lg:py-16 xl:px-20">
          <div className="mx-auto w-full max-w-xl min-w-0 lg:mx-0">
            <AuthBrand width={128} />
            <AnimateIn className="mt-12 sm:mt-16 lg:mt-20">
              <p className="text-ink-emphasis text-body-sm">For anyone looking for work</p>
              <h1 className="text-h3 sm:text-h2 md:text-h1 mt-3 font-medium text-balance text-foreground">
                Find jobs that fit your experience.
              </h1>
              <p className="text-muted-foreground mt-4 max-w-[min(22rem,calc(100vw-2rem))] text-body sm:max-w-md sm:text-body-lg">
                {noWidow(
                  "Add your CV. Optra searches open job listings and shows you a short list. Each job includes a plain explanation of why it matches you. You choose what happens next.",
                )}
              </p>
            </AnimateIn>

            <AnimateIn delayMs={80} className="mt-8">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className={buttonVariants({ variant: "capsule", className: "max-sm:w-full" })}
                >
                  <CapsuleLabel className="max-sm:w-full">Create an account</CapsuleLabel>
                </Link>
                <Link
                  href="/login"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                    className: "max-sm:w-full",
                  })}
                >
                  I have an account
                </Link>
              </div>

              {/* Below lg the photo follows the actions, so they stay above the fold. */}
              <HeroPhoto className="relative mt-10 aspect-[4/3] w-full min-w-0 overflow-hidden rounded-card bg-subtle lg:hidden" />

              <ol className="mt-8 divide-y divide-border border-y border-border">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex items-baseline gap-4 py-3.5">
                    <span className="text-brand-ink w-5 shrink-0 text-body-sm tabular">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="text-foreground block text-body">{step.title}</span>
                      <span className="text-muted-foreground block text-body-sm">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </AnimateIn>
          </div>
        </main>

        <footer className="shrink-0 px-5 py-5 sm:px-10 lg:px-14 xl:px-20">
          <MakerCredit align="center" />
        </footer>
      </div>

      <HeroPhoto className="relative hidden min-h-svh overflow-hidden lg:block" />
    </div>
  );
}
