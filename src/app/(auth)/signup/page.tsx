import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";
import { ProductPanel } from "@/components/auth/product-panel";
import { noWidow } from "@/lib/utils";

export default function SignUpPage() {
  return (
    <AuthShell panel={<ProductPanel />}>
      <div className="max-w-sm">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--card-foreground)]">
          Create your account
        </h1>
        <p className="text-muted-foreground mt-2 mb-8 text-[14px]">
          {noWidow(
            "One private workspace. Next we'll learn about your work so job matches make sense.",
          )}
        </p>
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
