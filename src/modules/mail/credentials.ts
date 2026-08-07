import { getSecret, requireSecret } from "@/lib/security/secrets";
import {
  getGoogleOauthClient,
  refreshGoogleAccessToken,
} from "@/modules/mail/oauth-google";

/**
 * Mailbox credentials — Keychain / .env only (never SQLite).
 *
 * Two connection modes:
 * - oauth: Connect Gmail (refresh token + Google OAuth client)
 * - password: Other email (user/password + SMTP/IMAP hosts)
 *
 * Legacy GMAIL_USER / GMAIL_APP_PASSWORD still resolve.
 */

export type MailProvider = "gmail" | "fastmail" | "outlook" | "custom";
export type MailAuthMode = "password" | "oauth";

export type MailEndpoint = {
  host: string;
  port: number;
  secure: boolean;
};

export type MailCredentials = {
  user: string;
  provider: MailProvider;
  authMode: MailAuthMode;
  smtp: MailEndpoint;
  imap: MailEndpoint;
  /** Password auth */
  password?: string;
  /** OAuth auth */
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
};

/** @deprecated Use MailCredentials */
export type GmailCredentials = Pick<MailCredentials, "user"> & {
  appPassword: string;
};

type PresetEndpoints = { smtp: MailEndpoint; imap: MailEndpoint };

export const MAIL_PROVIDER_PRESETS: Record<
  Exclude<MailProvider, "custom">,
  PresetEndpoints
> = {
  gmail: {
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    imap: { host: "imap.gmail.com", port: 993, secure: true },
  },
  fastmail: {
    smtp: { host: "smtp.fastmail.com", port: 465, secure: true },
    imap: { host: "imap.fastmail.com", port: 993, secure: true },
  },
  outlook: {
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    imap: { host: "outlook.office365.com", port: 993, secure: true },
  },
};

const PROVIDERS = new Set<MailProvider>([
  "gmail",
  "fastmail",
  "outlook",
  "custom",
]);

export type MailEnv = Record<string, string | undefined>;

function readEnv(env: MailEnv, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseSecure(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

export function resolveMailProvider(raw: string | undefined): MailProvider {
  const normalized = raw?.trim().toLowerCase();
  if (normalized && PROVIDERS.has(normalized as MailProvider)) {
    return normalized as MailProvider;
  }
  return "gmail";
}

export function resolveMailEndpoints(
  provider: MailProvider,
  env: MailEnv = {},
): PresetEndpoints {
  if (provider !== "custom") {
    const preset = MAIL_PROVIDER_PRESETS[provider];
    return {
      smtp: {
        host: readEnv(env, "MAIL_SMTP_HOST") ?? preset.smtp.host,
        port: parsePort(readEnv(env, "MAIL_SMTP_PORT"), preset.smtp.port),
        secure: parseSecure(
          readEnv(env, "MAIL_SMTP_SECURE"),
          preset.smtp.secure,
        ),
      },
      imap: {
        host: readEnv(env, "MAIL_IMAP_HOST") ?? preset.imap.host,
        port: parsePort(readEnv(env, "MAIL_IMAP_PORT"), preset.imap.port),
        secure: parseSecure(
          readEnv(env, "MAIL_IMAP_SECURE"),
          preset.imap.secure,
        ),
      },
    };
  }

  const smtpHost = readEnv(env, "MAIL_SMTP_HOST");
  const imapHost = readEnv(env, "MAIL_IMAP_HOST");
  if (!smtpHost || !imapHost) {
    throw new Error(
      "Other email requires SMTP server and incoming (IMAP) server",
    );
  }

  return {
    smtp: {
      host: smtpHost,
      port: parsePort(readEnv(env, "MAIL_SMTP_PORT"), 465),
      secure: parseSecure(readEnv(env, "MAIL_SMTP_SECURE"), true),
    },
    imap: {
      host: imapHost,
      port: parsePort(readEnv(env, "MAIL_IMAP_PORT"), 993),
      secure: parseSecure(readEnv(env, "MAIL_IMAP_SECURE"), true),
    },
  };
}

function resolveAuthMode(env: MailEnv): MailAuthMode | null {
  const explicit = readEnv(env, "MAIL_AUTH_MODE")?.toLowerCase();
  if (explicit === "oauth" || explicit === "password") return explicit;
  if (readEnv(env, "MAIL_OAUTH_REFRESH_TOKEN")) return "oauth";
  if (readEnv(env, "MAIL_PASSWORD", "GMAIL_APP_PASSWORD")) return "password";
  return null;
}

/** Build credentials from an env-like map (secrets + optional host overrides). */
export function buildMailCredentialsFromEnv(env: MailEnv): MailCredentials | null {
  const user = readEnv(env, "MAIL_USER", "GMAIL_USER");
  if (!user) return null;

  const authMode = resolveAuthMode(env);
  if (!authMode) return null;

  try {
    const provider = resolveMailProvider(
      readEnv(env, "MAIL_PROVIDER") ??
        (authMode === "oauth"
          ? "gmail"
          : readEnv(env, "MAIL_SMTP_HOST", "MAIL_IMAP_HOST")
            ? "custom"
            : "gmail"),
    );
    const endpoints = resolveMailEndpoints(
      authMode === "oauth" ? "gmail" : provider,
      env,
    );

    if (authMode === "oauth") {
      const refreshToken = readEnv(env, "MAIL_OAUTH_REFRESH_TOKEN");
      const clientId = readEnv(env, "GOOGLE_OAUTH_CLIENT_ID");
      const clientSecret = readEnv(env, "GOOGLE_OAUTH_CLIENT_SECRET");
      if (!refreshToken || !clientId || !clientSecret) return null;
      return {
        user,
        provider: "gmail",
        authMode: "oauth",
        refreshToken,
        clientId,
        clientSecret,
        smtp: endpoints.smtp,
        imap: endpoints.imap,
      };
    }

    const password = readEnv(env, "MAIL_PASSWORD", "GMAIL_APP_PASSWORD");
    if (!password) return null;
    return {
      user,
      password,
      provider,
      authMode: "password",
      smtp: endpoints.smtp,
      imap: endpoints.imap,
    };
  } catch {
    return null;
  }
}

function secretEnv(): MailEnv {
  return {
    MAIL_USER: getSecret("MAIL_USER"),
    MAIL_PASSWORD: getSecret("MAIL_PASSWORD"),
    MAIL_PROVIDER: getSecret("MAIL_PROVIDER"),
    MAIL_AUTH_MODE: getSecret("MAIL_AUTH_MODE"),
    MAIL_OAUTH_REFRESH_TOKEN: getSecret("MAIL_OAUTH_REFRESH_TOKEN"),
    GOOGLE_OAUTH_CLIENT_ID: getSecret("GOOGLE_OAUTH_CLIENT_ID"),
    GOOGLE_OAUTH_CLIENT_SECRET: getSecret("GOOGLE_OAUTH_CLIENT_SECRET"),
    MAIL_SMTP_HOST: getSecret("MAIL_SMTP_HOST"),
    MAIL_SMTP_PORT: getSecret("MAIL_SMTP_PORT"),
    MAIL_SMTP_SECURE: getSecret("MAIL_SMTP_SECURE"),
    MAIL_IMAP_HOST: getSecret("MAIL_IMAP_HOST"),
    MAIL_IMAP_PORT: getSecret("MAIL_IMAP_PORT"),
    MAIL_IMAP_SECURE: getSecret("MAIL_IMAP_SECURE"),
    GMAIL_USER: getSecret("GMAIL_USER"),
    GMAIL_APP_PASSWORD: getSecret("GMAIL_APP_PASSWORD"),
  };
}

export function getMailCredentials(): MailCredentials | null {
  return buildMailCredentialsFromEnv(secretEnv());
}

export function requireMailCredentials(): MailCredentials {
  const creds = getMailCredentials();
  if (creds) return creds;
  throw new Error(
    "Mailbox not connected. Open Admin → Connect mailbox (Gmail or other email).",
  );
}

export function mailCredentialsConfigured(): boolean {
  return getMailCredentials() !== null;
}

/** Fresh access token for IMAP XOAUTH2 (OAuth mode only). */
export async function getMailAccessToken(
  creds: MailCredentials = requireMailCredentials(),
): Promise<string> {
  if (creds.authMode !== "oauth" || !creds.refreshToken) {
    throw new Error("Mailbox is not connected with Gmail sign-in");
  }
  const client = getGoogleOauthClient();
  if (!client) requireSecret("GOOGLE_OAUTH_CLIENT_ID");
  return refreshGoogleAccessToken(creds.refreshToken);
}

/** @deprecated Use getMailCredentials */
export function getGmailCredentials(): GmailCredentials | null {
  const creds = getMailCredentials();
  if (!creds?.password) return null;
  return { user: creds.user, appPassword: creds.password };
}

/** @deprecated Use requireMailCredentials */
export function requireGmailCredentials(): GmailCredentials {
  const creds = requireMailCredentials();
  if (!creds.password) {
    throw new Error("Password auth required");
  }
  return { user: creds.user, appPassword: creds.password };
}

/** @deprecated Use mailCredentialsConfigured */
export function gmailCredentialsConfigured(): boolean {
  return mailCredentialsConfigured();
}
