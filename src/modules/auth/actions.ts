"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureDb } from "@/db/ensure";
import {
  authenticateUser,
  countUsers,
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  issuePasswordReset,
  resetPasswordWithToken,
} from "@/modules/auth/session";

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

    if (await findUserByEmail(parsed.data.email)) {
      return { error: "An account with that email already exists." };
    }

    // Private app: allow first account freely; later accounts still allowed for now.
    const user = await createUser(parsed.data);
    await createSession(user.id);
  } catch (err) {
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

    const user = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!user) {
      return { error: "Invalid email or password." };
    }

    await createSession(user.id);
  } catch (err) {
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

    const result = await issuePasswordReset(email);
    if (!result.ok) return { error: result.error };

    return {
      success:
        "If that email exists, a reset link is ready. Local apps show the link below — no inbox required yet.",
      resetPath: result.resetPath,
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

    const result = await resetPasswordWithToken(token, password);
    if (!result.ok) return { error: result.error };

    await createSession(result.userId);
  } catch (err) {
    const dbError = dbWriteErrorMessage(err);
    if (dbError) return { error: dbError };
    throw err;
  }
  redirect("/");
}

export async function signOutAction() {
  await ensureDb();
  await destroySession();
  redirect("/welcome");
}

export async function getAuthBootstrap() {
  await ensureDb();
  return { hasUsers: (await countUsers()) > 0 };
}
