import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { noWidow } from "@/lib/utils";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthShell>
      <AuthHeading
        title="Set a new password"
        description={noWidow(
          "Choose a password you'll remember. Other sessions will be signed out.",
        )}
      />
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
