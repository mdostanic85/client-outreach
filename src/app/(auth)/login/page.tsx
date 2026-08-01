import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";
import { ProductPanel } from "@/components/auth/product-panel";
import { noWidow } from "@/lib/utils";

export default function LoginPage() {
  return (
    <AuthShell
      panel={
        <ProductPanel
          eyebrow="Welcome back"
          headline={noWidow(
            "Pick up today's shortlist. The reasoning is already there.",
          )}
        />
      }
    >
      <div className="max-w-sm">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--card-foreground)]">
          Log in
        </h1>
        <p className="text-muted-foreground mt-2 mb-8 text-[14px]">
          {noWidow("Sign in to review today's roles and continue outreach.")}
        </p>
        <SignInForm />
      </div>
    </AuthShell>
  );
}
