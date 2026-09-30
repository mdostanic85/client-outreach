import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";
import {
  AuthDivider,
  GoogleSignInButton,
} from "@/components/auth/google-sign-in";
import { ProductPanel } from "@/components/auth/product-panel";
import { googleSignInEnabled } from "@/modules/auth/auth";
import { noWidow } from "@/lib/utils";

export default function SignUpPage() {
  return (
    <AuthShell panel={<ProductPanel />}>
      <div className="max-w-sm">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--card-foreground)]">
          Create your account
        </h1>
        <p className="text-muted-foreground mt-2 mb-5 text-[14px]">
          {noWidow(
            "Next we'll read your CV and ask a few questions, so the jobs we show actually fit you.",
          )}
        </p>
        {googleSignInEnabled() ? (
          <div className="mb-4 flex flex-col gap-4">
            <GoogleSignInButton />
            <AuthDivider />
          </div>
        ) : null}
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
