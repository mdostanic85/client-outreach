import { redirect } from "next/navigation";
import { AuthBrand } from "@/components/auth/auth-shell";
import { MakerCredit } from "@/components/maker-credit";
import { ensureDb } from "@/db/ensure";
import { getSessionUser } from "@/modules/auth/session";
import { getUserOnboardingCompletedAt } from "@/modules/onboarding/state";
import { signOutAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) {
    redirect("/welcome");
  }

  // Only leave once the wizard marks complete — don't auto-skip the Done step.
  if (await getUserOnboardingCompletedAt(user.id)) {
    redirect("/");
  }

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-5">
        <AuthBrand />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="px-4 pb-5 sm:px-8">
        <MakerCredit align="center" />
      </footer>
    </div>
  );
}
