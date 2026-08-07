import { getSecret, setSecret, clearSecret } from "@/lib/security/secrets";

const OAUTH_SCOPE = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const STATE_COOKIE = "optra_mail_oauth_state";

export function mailOauthStateCookieName() {
  return STATE_COOKIE;
}

export function getGoogleOauthClient(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = getSecret("GOOGLE_OAUTH_CLIENT_ID")?.trim();
  const clientSecret = getSecret("GOOGLE_OAUTH_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleOauthClientConfigured(): boolean {
  return getGoogleOauthClient() !== null;
}

export function googleOauthRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/mail/oauth/google/callback`;
}

export function buildGoogleOauthAuthUrl(input: {
  origin: string;
  state: string;
}): string {
  const client = getGoogleOauthClient();
  if (!client) {
    throw new Error(
      "Google OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    );
  }
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: googleOauthRedirectUri(input.origin),
    response_type: "code",
    scope: OAUTH_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function exchangeGoogleAuthCode(input: {
  code: string;
  origin: string;
}): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const client = getGoogleOauthClient();
  if (!client) throw new Error("Google OAuth is not configured");

  const body = new URLSearchParams({
    code: input.code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: googleOauthRedirectUri(input.origin),
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse & { error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error || "Failed to exchange Google auth code");
  }
  if (!json.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke Optra access in Google Account → Security → Third-party access, then connect again.",
    );
  }

  const email = await fetchGoogleEmail(json.access_token);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    email,
  };
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = (await res.json()) as { email?: string; error?: { message?: string } };
  if (!res.ok || !json.email) {
    throw new Error(json.error?.message || "Could not read Gmail address");
  }
  return json.email.trim().toLowerCase();
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<string> {
  const client = getGoogleOauthClient();
  if (!client) throw new Error("Google OAuth is not configured");

  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse & { error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error || "Failed to refresh Google access token");
  }
  return json.access_token;
}

/** Persist Gmail OAuth connection (Keychain / .env). */
export function saveGoogleOauthConnection(input: {
  email: string;
  refreshToken: string;
}) {
  setSecret("MAIL_AUTH_MODE", "oauth");
  setSecret("MAIL_PROVIDER", "gmail");
  setSecret("MAIL_USER", input.email);
  setSecret("MAIL_OAUTH_REFRESH_TOKEN", input.refreshToken);
  // Clear password path leftovers
  for (const name of [
    "MAIL_PASSWORD",
    "MAIL_SMTP_HOST",
    "MAIL_SMTP_PORT",
    "MAIL_SMTP_SECURE",
    "MAIL_IMAP_HOST",
    "MAIL_IMAP_PORT",
    "MAIL_IMAP_SECURE",
    "GMAIL_APP_PASSWORD",
  ] as const) {
    try {
      clearSecret(name);
    } catch {
      // ignore missing
    }
  }
  // Keep GMAIL_USER in sync for legacy readers
  setSecret("GMAIL_USER", input.email);
}

export function savePasswordMailboxConnection(input: {
  email: string;
  password: string;
  smtpHost: string;
  imapHost: string;
  smtpPort?: string;
  imapPort?: string;
  provider?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const smtpHost = input.smtpHost.trim();
  const imapHost = input.imapHost.trim();
  if (!email || !input.password.trim() || !smtpHost || !imapHost) {
    throw new Error("Email, password, SMTP server, and incoming server are required");
  }

  setSecret("MAIL_AUTH_MODE", "password");
  setSecret("MAIL_PROVIDER", input.provider ?? "custom");
  setSecret("MAIL_USER", email);
  setSecret("MAIL_PASSWORD", input.password.trim());
  setSecret("MAIL_SMTP_HOST", smtpHost);
  setSecret("MAIL_IMAP_HOST", imapHost);
  if (input.smtpPort?.trim()) setSecret("MAIL_SMTP_PORT", input.smtpPort.trim());
  if (input.imapPort?.trim()) setSecret("MAIL_IMAP_PORT", input.imapPort.trim());

  try {
    clearSecret("MAIL_OAUTH_REFRESH_TOKEN");
  } catch {
    // ignore
  }
}

export function disconnectMailbox() {
  const names = [
    "MAIL_AUTH_MODE",
    "MAIL_PROVIDER",
    "MAIL_USER",
    "MAIL_PASSWORD",
    "MAIL_OAUTH_REFRESH_TOKEN",
    "MAIL_SMTP_HOST",
    "MAIL_SMTP_PORT",
    "MAIL_SMTP_SECURE",
    "MAIL_IMAP_HOST",
    "MAIL_IMAP_PORT",
    "MAIL_IMAP_SECURE",
    "GMAIL_USER",
    "GMAIL_APP_PASSWORD",
  ] as const;
  for (const name of names) {
    try {
      clearSecret(name);
    } catch {
      // ignore
    }
  }
}

export type MailboxConnectionStatus = {
  connected: boolean;
  email: string | null;
  mode: "oauth" | "password" | null;
  provider: string | null;
  label: string | null;
  googleOauthReady: boolean;
};

export function getMailboxConnectionStatus(): MailboxConnectionStatus {
  const user =
    getSecret("MAIL_USER")?.trim() || getSecret("GMAIL_USER")?.trim() || null;
  const modeRaw = getSecret("MAIL_AUTH_MODE")?.trim().toLowerCase();
  const refresh = getSecret("MAIL_OAUTH_REFRESH_TOKEN")?.trim();
  const password =
    getSecret("MAIL_PASSWORD")?.trim() ||
    getSecret("GMAIL_APP_PASSWORD")?.trim();
  const provider = getSecret("MAIL_PROVIDER")?.trim() || null;

  let mode: "oauth" | "password" | null = null;
  if (modeRaw === "oauth" || refresh) mode = "oauth";
  else if (modeRaw === "password" || password) mode = "password";

  const connected = Boolean(user && mode);

  let label: string | null = null;
  if (connected && mode === "oauth") label = "Gmail (signed in)";
  else if (connected && provider === "gmail") label = "Gmail";
  else if (connected && provider) label = provider;
  else if (connected) label = "Other email";

  return {
    connected,
    email: user,
    mode: connected ? mode : null,
    provider,
    label,
    googleOauthReady: googleOauthClientConfigured(),
  };
}
