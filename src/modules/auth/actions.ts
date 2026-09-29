"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { ensureDb } from "@/db/ensure";
import { getAuth, resetTokenCapture } from "@/modules/auth/auth";
import { countUsers } from "@/modules/auth/session";

export type AuthFormState = {
  error?: string;
  success?: string;
  resetPath?: string;
};

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().max(80).optional(),
});

function dbWriteErrorMessage(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("DATABASE_URL") ||
    message.includes("password authentication failed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("connection") && message.includes("failed")
  ) {
    return "Database is unavailable. Set DATABASE_URL to your Neon PostgreSQL connection string.";
  }
  return null;
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await ensureDb();
    const parsed = credentialsSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { email, password, name } = parsed.data;
    // Private app: allow first account freely; later accounts still allowed for now.
    await getAuth().api.signUpEmail({
      body: {
        email,
        password,
        name: name?.trim() || email.split("@")[0],
      },
      headers: await headers(),
    });
  } catch (err) {
    if (isAPIError(err) && err.body?.code?.startsWith("USER_ALREADY_EXISTS")) {
      return { error: "An account with that email already exists." };
    }
    const dbError = dbWriteErrorMessage(err);
    if (dbError) return { error: dbError };
    throw err;
  }
  redirect("/onboarding");
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await ensureDb();
    const parsed = credentialsSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    await getAuth().api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (err) {
    if (isAPIError(err) && err.status === "UNAUTHORIZED") {
      return { error: "Invalid email or password." };
    }
    const dbError = dbWriteErrorMessage(err);
    if (dbError) return { error: dbError };
    throw err;
  }
  redirect("/");
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await ensureDb();
    const email = String(formData.get("email") ?? "").trim();
    if (!email.includes("@")) {
      return { error: "Enter a valid email." };
    }

    const captured: { token?: string } = {};
    const requestHeaders = await headers();
    await resetTokenCapture.run(captured, () =>
      getAuth().api.requestPasswordReset({
        body: { email },
        headers: requestHeaders,
      }),
    );

    // No email provider yet. Handing the link to whoever typed the address is
    // only acceptable on a local install — on a deployed app it would let
    // anyone reset anyone's password.
    const showLink = process.env.VERCEL !== "1";
    return {
      success: showLink
        ? "If that email exists, a reset link is ready. Local apps show the link below — no inbox required yet."
        : "Password reset by email isn't set up yet. Log in with Google if your account uses a Gmail address.",
      resetPath:
        showLink && captured.token
          ? `/reset-password?token=${encodeURIComponent(captured.token)}`
          : undefined,
    };
  } catch (err) {
    const dbError = dbWriteErrorMessage(err);
    if (dbError) return { error: dbError };
    throw err;
  }
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await ensureDb();
    const token = String(formData.get("token") ?? "");
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) {
      return { error: "Password must be at least 8 characters." };
    }

    await getAuth().api.resetPassword({
      body: { token, newPassword: password },
      headers: await headers(),
    });
  } catch (err) {
    if (isAPIError(err) && err.status === "BAD_REQUEST") {
      return { error: "This reset link is invalid or expired." };
    }
    const dbError = dbWriteErrorMessage(err);
    if (dbError) return { error: dbError };
    throw err;
  }
  // Better Auth's reset doesn't sign in; send the user to log in with the new password.
  redirect("/login?reset=1");
}

export async function signInWithGoogleAction() {
  await ensureDb();
  const result = await getAuth().api.signInSocial({
    body: {
      provider: "google",
      callbackURL: "/",
      newUserCallbackURL: "/onboarding",
      errorCallbackURL: "/login",
    },
    headers: await headers(),
  });
  if (!result.url) redirect("/login?error=google_unavailable");
  redirect(result.url);
}

export async function signOutAction() {
  await ensureDb();
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/welcome");
}

export async function getAuthBootstrap() {
  await ensureDb();
  return { hasUsers: (await countUsers()) > 0 };
}
