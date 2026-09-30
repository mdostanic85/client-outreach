"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useActionState, useState, type FormEvent } from "react";
import { MakerCredit } from "@/components/maker-credit";
import { OptraLogo } from "@/components/optra-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthDivider,
  GoogleSignInButton,
} from "@/components/auth/google-sign-in";
import { signInAction, type AuthFormState } from "@/modules/auth/actions";
import { cn, noWidow } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const initial: AuthFormState = {};

/**
 * Atmospheric canvas + email-first gate.
 * Direction: Peec/Midday presence + Linear friction reduction — Optra shortlist vernacular.
 */
export function LoginExperience({
  googleEnabled,
  error,
  notice,
}: {
  googleEnabled: boolean;
  error: string | null;
  notice: string | null;
}) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <LoginAtmosphere reducedMotion={reducedMotion} />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link
          href="/welcome"
          className="text-muted-foreground hover:text-[var(--card-foreground)] text-[13px] font-medium transition-colors"
        >
          ← Back
        </Link>
        <Link
          href="/signup"
          className="text-muted-foreground hover:text-[var(--card-foreground)] text-[13px] font-medium transition-colors"
        >
          Create account
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-4">
        <motion.div
          className="flex w-full max-w-md flex-col items-center"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div className="mb-10 flex flex-col items-center">
            <OptraLogo href="/welcome" width={133} />
          </div>

          <p className="text-muted-foreground mb-8 max-w-sm text-center text-[16px] leading-relaxed">
            {noWidow(
              "Optra reads your CV and shows you a few jobs that fit, with a plain reason for each one. Sign in to see today's list. Nothing is applied or emailed until you choose.",
            )}
          </p>

          <div className="border-border/60 bg-card/55 w-full rounded-[1.35rem] border px-5 py-6 backdrop-blur-xl sm:px-6 sm:py-7">
            <EmailFirstSignIn
              googleEnabled={googleEnabled}
              error={error}
              notice={notice}
            />
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 px-6 pb-8">
        <MakerCredit align="center" />
      </footer>
    </div>
  );
}

function LoginAtmosphere({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 70% at 50% 0%, #14201c 0%, #0a0c11 48%, #080a0e 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 80% 85%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)",
        }}
      />

      {[34, 48, 64].map((size, i) => (
        <div
          key={size}
          className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            width: `min(${size}vw, ${size * 7}px)`,
            aspectRatio: "1",
            borderColor: `color-mix(in oklch, var(--primary) ${10 - i * 2}%, transparent)`,
            opacity: 0.5 - i * 0.1,
          }}
        />
      ))}

      <motion.div
        className="absolute left-1/2 top-[40%] size-[min(52vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
        animate={
          reducedMotion
            ? { opacity: 0.2 }
            : { opacity: [0.14, 0.28, 0.14], scale: [1, 1.08, 1] }
        }
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 10, repeat: Infinity, ease: "easeInOut" }
        }
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 55%, transparent), transparent 70%)",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

function EmailFirstSignIn({
  googleEnabled,
  error,
  notice,
}: {
  googleEnabled: boolean;
  error: string | null;
  notice: string | null;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(signInAction, initial);

  function continueWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value.includes("@") || value.length < 3) {
      setEmailError("Enter a valid email.");
      return;
    }
    setEmailError(null);
    setStep("password");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[1.35rem] font-semibold tracking-tight text-[var(--card-foreground)]">
          {step === "email" ? "Sign in" : "Enter your password"}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-[15px] leading-snug">
          {step === "email" ? "Your jobs stay on this account." : email}
        </p>
      </div>

      {step === "email" && error ? <FieldError message={error} /> : null}
      {step === "email" && notice ? (
        <p className="bg-primary/10 text-accent-foreground rounded-xl px-3.5 py-2.5 text-[14px]">
          {notice}
        </p>
      ) : null}

      {step === "email" && googleEnabled ? (
        <>
          <GoogleSignInButton className="h-12 rounded-xl" />
          <AuthDivider />
        </>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {step === "email" ? (
          <motion.form
            key="email-step"
            onSubmit={continueWithEmail}
            className="flex flex-col gap-4"
            initial={reducedMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={
              reducedMotion
                ? undefined
                : { opacity: 0, x: -12, transition: { duration: 0.18 } }
            }
            transition={{ duration: 0.28, ease: EASE }}
          >
            {emailError ? <FieldError message={emailError} /> : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="bg-background/40 h-12"
              />
            </div>
            <Button type="submit" size="lg" className="mt-1 h-12 w-full rounded-xl">
              Continue
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="password-step"
            action={action}
            className="flex flex-col gap-4"
            initial={reducedMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={
              reducedMotion
                ? undefined
                : { opacity: 0, x: 12, transition: { duration: 0.18 } }
            }
            transition={{ duration: 0.28, ease: EASE }}
          >
            <FieldError message={state.error} />
            <input type="hidden" name="email" value={email} />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-primary text-[13px] font-medium hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoFocus
                autoComplete="current-password"
                placeholder="Your password"
                className="bg-background/40 h-12"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="mt-1 h-12 w-full rounded-xl"
            >
              {pending ? "Signing in…" : "Log in"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className={cn(
                "text-muted-foreground hover:text-[var(--card-foreground)] text-center text-[13px] font-medium transition-colors",
              )}
            >
              Use a different email
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {step === "email" ? (
        <p className="text-muted-foreground text-center text-[13px]">
          New here?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="bg-destructive/10 text-destructive rounded-xl px-3.5 py-2.5 text-[14px]"
    >
      {message}
    </p>
  );
}
