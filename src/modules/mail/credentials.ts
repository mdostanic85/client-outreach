import { getSecret, requireSecret } from "@/lib/security/secrets";

export type GmailCredentials = {
  user: string;
  appPassword: string;
};

/**
 * Gmail app password credentials — Keychain only (never SQLite).
 * Accounts: GMAIL_USER, GMAIL_APP_PASSWORD
 */
export function getGmailCredentials(): GmailCredentials | null {
  const user = getSecret("GMAIL_USER");
  const appPassword = getSecret("GMAIL_APP_PASSWORD");
  if (!user || !appPassword) return null;
  return { user, appPassword };
}

export function requireGmailCredentials(): GmailCredentials {
  return {
    user: requireSecret("GMAIL_USER"),
    appPassword: requireSecret("GMAIL_APP_PASSWORD"),
  };
}

export function gmailCredentialsConfigured(): boolean {
  return getGmailCredentials() !== null;
}
