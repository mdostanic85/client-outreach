import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";
import {
  AuthDivider,
  GoogleSignInButton,
} from "@/components/auth/google-sign-in";
import { buttonVariants } from "@/components/ui/button";
import { googleSignInEnabled } from "@/modules/auth/auth";
import { noWidow } from "@/lib/utils";

export default function SignUpPage() {
  return (
    <AuthShell
      headerAction={
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Log in
        </Link>
      }
    >
      <AuthHeading
        title="Create your account"
        description={noWidow(
          "Next we'll read your CV and ask a few questions, so the jobs we show actually fit you.",
        )}
      />
      {googleSignInEnabled() ? (
        <div className="mb-4 flex flex-col gap-4">
          <GoogleSignInButton />
          <AuthDivider />
        </div>
      ) : null}
      <SignUpForm />
    </AuthShell>
  );
}
