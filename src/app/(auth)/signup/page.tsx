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
            "Private workspace. Next, we'll build your profile so matches stay accurate.",
          )}
        </p>
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
