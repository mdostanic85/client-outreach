import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import {
  authAccounts,
  authSessions,
  authVerifications,
  users,
} from "@/db/schema";
import { loadLocalEnv } from "@/lib/env";
import { newId } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/modules/auth/crypto";
import { RESET_TOKEN_MINUTES, SESSION_DAYS } from "@/modules/auth/constants";
import { getGoogleOauthClient } from "@/modules/mail/oauth-google";

const ID_PREFIX: Record<string, string> = {
  user: "usr",
  session: "ses",
  account: "acc",
  verification: "ver",
};

/**
 * No email provider yet: the reset action reads the token Better Auth hands to
 * `sendResetPassword` through this store instead of mailing it.
 */
export const resetTokenCapture = new AsyncLocalStorage<{ token?: string }>();

function baseUrl() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return undefined;
}

function createAuth() {
  loadLocalEnv();
  // Same Google Cloud OAuth client as the mailbox connect flow; sign-in only
  // asks for the basic openid/email/profile scopes.
  const google = getGoogleOauthClient();

  return betterAuth({
    appName: "Optra",
    baseURL: baseUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: users,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    user: {
      additionalFields: {
        onboardingCompletedAt: { type: "string", required: false, input: false },
      },
    },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
    },
    emailAndPassword: {
      enabled: true,
      // Keep the pre-Better-Auth scrypt format so migrated passwords verify.
      password: {
        hash: async (password) => hashPassword(password),
        verify: async ({ hash, password }) => verifyPassword(password, hash),
      },
      resetPasswordTokenExpiresIn: RESET_TOKEN_MINUTES * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ token }) => {
        const store = resetTokenCapture.getStore();
        if (store) store.token = token;
      },
    },
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            prompt: "select_account",
          },
        }
      : {},
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    advanced: {
      database: {
        generateId: ({ model }) => newId(ID_PREFIX[model]),
      },
    },
    // Failed OAuth callbacks land back on the login screen with `?error=`.
    onAPIError: { errorURL: "/login" },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | null = null;

/** Lazy so importing this module never needs DATABASE_URL (e.g. at build time). */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}

export function googleSignInEnabled() {
  loadLocalEnv();
  return getGoogleOauthClient() !== null;
}
