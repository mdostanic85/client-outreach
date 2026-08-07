import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadLocalEnv } from "@/lib/env";
import {
  buildGoogleOauthAuthUrl,
  getGoogleOauthClient,
  mailOauthStateCookieName,
} from "@/modules/mail/oauth-google";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  loadLocalEnv();
  if (!getGoogleOauthClient()) {
    return NextResponse.redirect(
      new URL(
        "/admin?mailbox=error&message=" +
          encodeURIComponent(
            "Add Google OAuth Client ID and Secret first (one-time setup).",
          ),
        request.url,
      ),
    );
  }

  const origin = new URL(request.url).origin;
  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  jar.set(mailOauthStateCookieName(), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: 60 * 10,
  });

  const url = buildGoogleOauthAuthUrl({ origin, state });
  return NextResponse.redirect(url);
}
