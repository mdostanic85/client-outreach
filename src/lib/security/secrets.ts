import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logging/logger";

const SERVICE = "client-outreach";

export type SecretSource = "keychain" | "env" | "missing";

export type TrackedSecret = {
  name: string;
  label: string;
  purpose: string;
  requiredFor: string;
  /** password = masked input; text = plain (e.g. email) */
  inputKind: "password" | "text";
  placeholder?: string;
  docsUrl?: string;
};

/** Secrets the Admin panel tracks and can write. Values never leave Keychain / .env. */
export const TRACKED_SECRETS: TrackedSecret[] = [
  {
    name: "GOOGLE_API_KEY",
    label: "Google Gemini",
    purpose: "Public triage, research, scoring",
    requiredFor: "Daily pipeline / research",
    inputKind: "password",
    placeholder: "AIza…",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic Claude",
    purpose: "Drafts, follow-ups, profile extract",
    requiredFor: "Writing & private LLM tasks",
    inputKind: "password",
    placeholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    name: "GOOGLE_OAUTH_CLIENT_ID",
    label: "Google OAuth client ID",
    purpose: "Connect Gmail with one click",
    requiredFor: "Mailbox → Connect Gmail",
    inputKind: "text",
    placeholder: "….apps.googleusercontent.com",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    name: "GOOGLE_OAUTH_CLIENT_SECRET",
    label: "Google OAuth client secret",
    purpose: "Connect Gmail with one click",
    requiredFor: "Mailbox → Connect Gmail",
    inputKind: "password",
    placeholder: "GOCSPX-…",
  },
  {
    name: "MAIL_AUTH_MODE",
    label: "Mailbox auth mode",
    purpose: "oauth | password — set by Mailbox connect UI",
    requiredFor: "Mailbox automation",
    inputKind: "text",
    placeholder: "oauth",
  },
  {
    name: "MAIL_OAUTH_REFRESH_TOKEN",
    label: "Mailbox OAuth refresh token",
    purpose: "Stored after Connect Gmail — do not paste manually",
    requiredFor: "Gmail OAuth send/sync",
    inputKind: "password",
  },
  {
    name: "MAIL_USER",
    label: "Mailbox user",
    purpose: "SMTP send + IMAP sync (any provider)",
    requiredFor: "Mailbox automation (Phase 3)",
    inputKind: "text",
    placeholder: "outreach@yourdomain.com",
  },
  {
    name: "MAIL_PASSWORD",
    label: "Mailbox password",
    purpose: "App password or SMTP/IMAP password",
    requiredFor: "Mailbox automation (Phase 3)",
    inputKind: "password",
    placeholder: "xxxx-xxxx-xxxx-xxxx",
  },
  {
    name: "MAIL_PROVIDER",
    label: "Mail provider",
    purpose: "Preset: gmail | fastmail | outlook | custom",
    requiredFor: "Mailbox automation (Phase 3)",
    inputKind: "text",
    placeholder: "gmail",
  },
  {
    name: "MAIL_SMTP_HOST",
    label: "SMTP host (custom)",
    purpose: "Outgoing mail server",
    requiredFor: "Other email connection",
    inputKind: "text",
    placeholder: "smtp.example.com",
  },
  {
    name: "MAIL_SMTP_PORT",
    label: "SMTP port",
    purpose: "Outgoing mail port (default 465)",
    requiredFor: "Other email connection",
    inputKind: "text",
    placeholder: "465",
  },
  {
    name: "MAIL_SMTP_SECURE",
    label: "SMTP secure",
    purpose: "true/false for TLS",
    requiredFor: "Other email connection",
    inputKind: "text",
    placeholder: "true",
  },
  {
    name: "MAIL_IMAP_HOST",
    label: "IMAP host (custom)",
    purpose: "Incoming mail server (for replies)",
    requiredFor: "Other email connection",
    inputKind: "text",
    placeholder: "imap.example.com",
  },
  {
    name: "MAIL_IMAP_PORT",
    label: "IMAP port",
    purpose: "Incoming mail port (default 993)",
    requiredFor: "Other email connection",
    inputKind: "text",
    placeholder: "993",
  },
  {
    name: "MAIL_IMAP_SECURE",
    label: "IMAP secure",
    purpose: "true/false for TLS",
    requiredFor: "Other email connection",
    inputKind: "text",
    placeholder: "true",
  },
  {
    name: "GMAIL_USER",
    label: "Gmail user (legacy)",
    purpose: "Fallback if MAIL_USER unset — migrate to MAIL_USER",
    requiredFor: "Legacy mailbox setups",
    inputKind: "text",
    placeholder: "outreach@yourdomain.com",
  },
  {
    name: "GMAIL_APP_PASSWORD",
    label: "Gmail app password (legacy)",
    purpose: "Fallback if MAIL_PASSWORD unset — migrate to MAIL_PASSWORD",
    requiredFor: "Legacy mailbox setups",
    inputKind: "password",
    placeholder: "xxxx-xxxx-xxxx-xxxx",
  },
  {
    name: "APIFY_TOKEN",
    label: "Apify",
    purpose: "Focused job collection (ATS / boards)",
    requiredFor: "Job discovery collectors (J2)",
    inputKind: "password",
    placeholder: "apify_api_…",
    docsUrl: "https://console.apify.com/account/integrations",
  },
];

/** Secrets managed by the Mailbox connect UI — hidden from generic API keys list. */
export const MAILBOX_SECRET_NAMES = new Set([
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "MAIL_AUTH_MODE",
  "MAIL_OAUTH_REFRESH_TOKEN",
  "MAIL_USER",
  "MAIL_PASSWORD",
  "MAIL_PROVIDER",
  "MAIL_SMTP_HOST",
  "MAIL_SMTP_PORT",
  "MAIL_SMTP_SECURE",
  "MAIL_IMAP_HOST",
  "MAIL_IMAP_PORT",
  "MAIL_IMAP_SECURE",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
]);

const TRACKED_NAMES = new Set(TRACKED_SECRETS.map((s) => s.name));

function assertTracked(name: string): void {
  if (!TRACKED_NAMES.has(name)) {
    throw new Error(`Unknown secret: ${name}`);
  }
}

function envFilePath(): string {
  return path.join(process.cwd(), ".env");
}

function readKeychain(name: string): string | undefined {
  if (process.platform !== "darwin") return undefined;
  try {
    const value = execFileSync(
      "security",
      ["find-generic-password", "-s", SERVICE, "-a", name, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function writeKeychain(name: string, value: string): void {
  execFileSync(
    "security",
    [
      "add-generic-password",
      "-s",
      SERVICE,
      "-a",
      name,
      "-w",
      value,
      "-U",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
}

function deleteKeychain(name: string): boolean {
  if (process.platform !== "darwin") return false;
  try {
    execFileSync(
      "security",
      ["delete-generic-password", "-s", SERVICE, "-a", name],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return true;
  } catch {
    return false;
  }
}

/** Upsert KEY=value in local .env (creates file if missing). */
function writeEnvFile(name: string, value: string): void {
  const file = envFilePath();
  const escaped = value.replace(/\n/g, "");
  const line = `${name}=${escaped}`;
  if (!existsSync(file)) {
    writeFileSync(file, `${line}\n`, "utf8");
    return;
  }
  const raw = readFileSync(file, "utf8");
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const next = pattern.test(raw)
    ? raw.replace(pattern, line)
    : `${raw.replace(/\s*$/, "")}\n${line}\n`;
  writeFileSync(file, next, "utf8");
}

function clearEnvFile(name: string): void {
  const file = envFilePath();
  if (!existsSync(file)) return;
  const raw = readFileSync(file, "utf8");
  const pattern = new RegExp(`^${name}=.*\\n?`, "m");
  writeFileSync(file, raw.replace(pattern, ""), "utf8");
}

/**
 * Resolve a secret from macOS Keychain, falling back to process.env for local dev.
 * Keychain account names match env var names (e.g. GOOGLE_API_KEY).
 */
export function getSecret(name: string): string | undefined {
  const fromKeychain = readKeychain(name);
  if (fromKeychain) return fromKeychain;

  const fromEnv = process.env[name];
  if (fromEnv) {
    if (process.env.NODE_ENV !== "test") {
      logger.debug({ secret: name }, "Using .env fallback for secret");
    }
    return fromEnv;
  }

  return undefined;
}

/** Presence only — never returns the secret value. */
export function getSecretPresence(name: string): SecretSource {
  if (readKeychain(name)) return "keychain";
  if (process.env[name]?.trim()) return "env";
  return "missing";
}

export function getSecretsStatus(): Array<
  TrackedSecret & { source: SecretSource; present: boolean }
> {
  return TRACKED_SECRETS.map((secret) => {
    const source = getSecretPresence(secret.name);
    return { ...secret, source, present: source !== "missing" };
  });
}

/**
 * Persist a secret. Prefers macOS Keychain; falls back to .env on other platforms.
 * Never returns the value. Updates process.env so the running process sees it immediately.
 */
export function setSecret(
  name: string,
  value: string,
): Exclude<SecretSource, "missing"> {
  assertTracked(name);
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Secret value cannot be empty");
  }

  if (process.platform === "darwin") {
    writeKeychain(name, trimmed);
    process.env[name] = trimmed;
    logger.info({ secret: name }, "Secret stored in Keychain");
    return "keychain";
  }

  writeEnvFile(name, trimmed);
  process.env[name] = trimmed;
  logger.info({ secret: name }, "Secret stored in .env");
  return "env";
}

/**
 * Remove a secret from Keychain and/or .env and clear process.env.
 */
export function clearSecret(name: string): void {
  assertTracked(name);
  deleteKeychain(name);
  clearEnvFile(name);
  delete process.env[name];
  logger.info({ secret: name }, "Secret cleared");
}

export function keychainServiceName(): string {
  return SERVICE;
}

export function requireSecret(name: string): string {
  const value = getSecret(name);
  if (!value) {
    throw new Error(
      `Missing secret ${name}. Store in macOS Keychain (service=${SERVICE}, account=${name}) or set in .env`,
    );
  }
  return value;
}
