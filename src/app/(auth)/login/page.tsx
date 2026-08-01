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
            "Continue where you left off. Today's job list is ready.",
          )}
        />
      }
    >
      <div className="max-w-sm">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--card-foreground)]">
          Log in
        </h1>
        <p className="text-muted-foreground mt-2 mb-8 text-[14px]">
          {noWidow(
            "Sign in to see today's jobs and follow up when you're ready.",
          )}
        </p>
        <SignInForm />
      </div>
    </AuthShell>
  );
}
