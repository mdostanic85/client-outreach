import { LoginExperience } from "@/components/auth/login-experience";
import { googleSignInEnabled } from "@/modules/auth/auth";
import { authErrorMessage } from "@/modules/auth/constants";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <LoginExperience
      googleEnabled={googleSignInEnabled()}
      error={authErrorMessage(error)}
      notice={reset ? "Password updated. Log in with your new password." : null}
    />
  );
}
