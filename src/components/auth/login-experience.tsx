"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useActionState, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthDivider,
  GoogleSignInButton,
} from "@/components/auth/google-sign-in";
import { signInAction, type AuthFormState } from "@/modules/auth/actions";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EXIT: [number, number, number, number] = [0.32, 0, 0.67, 0];
const initial: AuthFormState = {};

/** Email-first sign-in in the shared centered auth card. */
export function LoginExperience({
  googleEnabled,
  error,
  notice,
}: {
  googleEnabled: boolean;
  error: string | null;
  notice: string | null;
}) {
  return (
    <AuthShell>
      <EmailFirstSignIn googleEnabled={googleEnabled} error={error} notice={notice} />
    </AuthShell>
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
        <h1 className="text-h4 text-foreground font-medium">
          {step === "email" ? "Sign in" : "Enter your password"}
        </h1>
        <p className="text-muted-foreground mt-1 text-body-sm">
          {step === "email" ? "Your jobs stay on this account." : email}
        </p>
      </div>

      {step === "email" && error ? <FieldError message={error} /> : null}
      {step === "email" && notice ? (
        <p role="status" className="bg-brand-wash text-brand-ink rounded-tile px-4 py-3 text-body-sm">
          {notice}
        </p>
      ) : null}

      {step === "email" && googleEnabled ? (
        <>
          <GoogleSignInButton />
          <AuthDivider />
        </>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {step === "email" ? (
          <motion.form
            key="email-step"
            onSubmit={continueWithEmail}
            className="flex flex-col gap-4"
            initial={reducedMotion ? false : { opacity: 0, y: -12, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={
              reducedMotion
                ? undefined
                : { opacity: 0, y: -12, filter: "blur(3px)", transition: { duration: 0.18, ease: EXIT } }
            }
            transition={{ duration: 0.32, ease: EASE }}
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
              />
            </div>
            <Button type="submit" size="lg" className="mt-2 w-full">
              Continue
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="password-step"
            action={action}
            className="flex flex-col gap-4"
            initial={reducedMotion ? false : { opacity: 0, y: 12, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={
              reducedMotion
                ? undefined
                : { opacity: 0, y: 12, filter: "blur(3px)", transition: { duration: 0.18, ease: EXIT } }
            }
            transition={{ duration: 0.32, ease: EASE }}
          >
            <FieldError message={state.error} />
            <input type="hidden" name="email" value={email} />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-brand-ink rounded-md text-body-sm font-medium hover:underline"
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
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="mt-2 w-full"
            >
              {pending ? "Signing in…" : "Log in"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-md text-center text-body-sm font-medium transition-colors duration-150",
              )}
            >
              Use a different email
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {step === "email" ? (
        <p className="text-muted-foreground text-center text-body-sm">
          New here?{" "}
          <Link href="/signup" className="text-brand-ink rounded-md font-medium hover:underline">
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
      className="bg-destructive-wash text-destructive rounded-tile px-4 py-3 text-body-sm"
    >
      {message}
    </p>
  );
}
