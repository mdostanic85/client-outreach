import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureDb } from "@/db/ensure";
import { loadLocalEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { getRequestUser } from "@/modules/auth/page-guards";
import {
  exchangeGoogleAuthCode,
  mailOauthStateCookieName,
  saveGoogleOauthConnection,
} from "@/modules/mail/oauth-google";

export const dynamic = "force-dynamic";

function redirectAdmin(request: Request, query: Record<string, string>) {
  const url = new URL("/admin", request.url);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/** Saves the shared mailbox token: the owner's own session must finish the flow. */
export async function GET(request: Request) {
  loadLocalEnv();
  await ensureDb();
  const caller = await getRequestUser();
  if (!caller) return NextResponse.redirect(new URL("/login", request.url));
  if (!caller.owner) return NextResponse.redirect(new URL("/", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectAdmin(request, {
      mailbox: "error",
      message: oauthError,
    });
  }

  const jar = await cookies();
  const expected = jar.get(mailOauthStateCookieName())?.value;
  jar.delete(mailOauthStateCookieName());

  if (!code || !state || !expected || state !== expected) {
    return redirectAdmin(request, {
      mailbox: "error",
      message: "Gmail sign-in was cancelled or expired. Try again.",
    });
  }

  try {
    const origin = url.origin;
    const tokens = await exchangeGoogleAuthCode({ code, origin });
    saveGoogleOauthConnection({
      email: tokens.email,
      refreshToken: tokens.refreshToken,
    });
    return redirectAdmin(request, {
      mailbox: "connected",
      message: tokens.email,
    });
  } catch (err) {
    logger.warn({ err }, "gmail oauth connection failed");
    return redirectAdmin(request, {
      mailbox: "error",
      message:
        err instanceof Error ? err.message : "Could not connect Gmail",
    });
  }
}
