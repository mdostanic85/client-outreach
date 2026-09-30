"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from "@/modules/auth/actions";

const initial: AuthFormState = {};

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

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldError message={state.error} />
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Alex" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-muted-foreground text-center text-body-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-ink rounded-md font-medium hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldError message={state.error} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-brand-ink rounded-md text-body-sm font-medium hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="Your password"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Log in"}
      </Button>
      <p className="text-muted-foreground text-center text-body-sm">
        New here?{" "}
        <Link href="/signup" className="text-brand-ink rounded-md font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldError message={state.error} />
      {state.success ? (
        <div className="bg-brand-wash text-brand-ink space-y-3 rounded-tile px-4 py-3 text-body-sm">
          <p>{state.success}</p>
          {state.resetPath ? (
            <p>
              Reset link:{" "}
              <Link
                href={state.resetPath}
                className="text-brand-ink font-medium underline-offset-2 hover:underline"
              >
                {state.resetPath}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-muted-foreground text-center text-body-sm">
        <Link href="/login" className="text-brand-ink rounded-md font-medium hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  if (!token) {
    return (
      <div className="space-y-4">
        <FieldError message="Missing reset token. Request a new link." />
        <Link
          href="/forgot-password"
          className={buttonVariants({ className: "w-full" })}
        >
          Request reset link
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldError message={state.error} />
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
