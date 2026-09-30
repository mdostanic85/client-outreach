import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { ProductPanel } from "@/components/auth/product-panel";
import { noWidow } from "@/lib/utils";

export default function ForgotPasswordPage() {
  return (
    <AuthShell panel={<ProductPanel />}>
      <div className="max-w-sm">
        <h1 className="text-[1.75rem] font-medium tracking-tight text-foreground">
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
