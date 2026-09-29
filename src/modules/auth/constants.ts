export const SESSION_DAYS = 30;
export const RESET_TOKEN_MINUTES = 60;

/** Maps Better Auth's `?error=` codes to copy for the login screen. */
export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "account_not_linked") {
    return "That email already has a password account. Log in with your password.";
  }
  if (code === "google_unavailable") {
    return "Google sign-in isn't available right now. Use your email and password.";
  }
  return "Google sign-in didn't finish. Try again.";
}
