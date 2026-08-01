import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { ProductPanel } from "@/components/auth/product-panel";
import { noWidow } from "@/lib/utils";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthShell
      panel={
        <ProductPanel
          eyebrow="Almost there"
          headline={noWidow(
            "Set a new password, then go back to today's job list.",
          )}
        />
      }
    >
      <div className="max-w-sm">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--card-foreground)]">
          Set a new password
        </h1>
        <p className="text-muted-foreground mt-2 mb-8 text-[14px]">
          {noWidow(
            "Choose something you'll remember. Existing sessions will be signed out.",
          )}
        </p>
        <ResetPasswordForm token={token} />
      </div>
    </AuthShell>
  );
}
