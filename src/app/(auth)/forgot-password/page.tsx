import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { noWidow } from "@/lib/utils";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading
        title="Forgot password"
        description={noWidow("Enter your email and we'll make a one-time reset link.")}
      />
      <ForgotPasswordForm />
    </AuthShell>
  );
}
