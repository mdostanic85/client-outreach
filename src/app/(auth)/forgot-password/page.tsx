import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { ProductPanel } from "@/components/auth/product-panel";
import { noWidow } from "@/lib/utils";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      panel={
        <ProductPanel
          eyebrow="Account recovery"
          headline={noWidow(
            "Reset your password here. No email inbox needed on this private setup.",
          )}
        />
      }
    >
      <div className="max-w-sm">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--card-foreground)]">
          Forgot password
        </h1>
        <p className="text-muted-foreground mt-2 mb-8 text-[14px]">
          {noWidow(
            "Enter your email and we'll make a one-time reset link.",
          )}
        </p>
        <ForgotPasswordForm />
      </div>
    </AuthShell>
  );
}
