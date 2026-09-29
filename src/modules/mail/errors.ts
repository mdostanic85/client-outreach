/**
 * Turns raw SMTP/nodemailer errors into copy a non-technical user can act on.
 * The raw message is always logged separately (see call sites) — this is
 * only for what reaches the UI.
 */
export function describeMailError(err: unknown, host?: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  const isGmail = /gmail\.com|googlemail\.com/i.test(host ?? raw);

  // 535 / EAUTH: server reachable, but the username+password (or token) was rejected.
  if (/535|5\.7\.8|invalid login|username and password not accepted/i.test(raw) || code === "EAUTH") {
    if (isGmail) {
      return (
        "Gmail rejected that login. Gmail no longer accepts your normal account " +
        "password for apps — use an App Password instead: turn on 2-Step Verification, " +
        "then create one at https://myaccount.google.com/apppasswords. Or use the " +
        "\"Connect\" (Google sign-in) button above instead of Other email."
      );
    }
    return (
      "That email/password was rejected. If this account has 2-factor authentication, " +
      "use an app-specific password instead of the regular one."
    );
  }

  // Connection-level failures: wrong host/port, server unreachable, TLS mismatch.
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/.test(code) || /ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(raw)) {
    return `Could not reach ${host ?? "the mail server"}. Check the SMTP server address and port.`;
  }

  if (/self.signed|certificate|SSL|TLS/i.test(raw)) {
    return `Secure connection to ${host ?? "the mail server"} failed. Check the port and try toggling secure/STARTTLS.`;
  }

  return raw.slice(0, 300);
}
