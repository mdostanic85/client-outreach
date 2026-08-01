import { redirect } from "next/navigation";
import { AuthBrand } from "@/components/auth/auth-shell";
import { ensureDb } from "@/db/ensure";
import { countUsers, getSessionUser } from "@/modules/auth/session";
import { getUserOnboardingCompletedAt } from "@/modules/onboarding/state";
import { signOutAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureDb();
  const user = await getSessionUser();
  if (!user) {
    redirect(countUsers() === 0 ? "/welcome" : "/login");
  }

  // Only leave once the wizard marks complete — don't auto-skip the Done step.
  if (getUserOnboardingCompletedAt(user.id)) {
    redirect("/");
  }

  return (
    <div className="bg-background relative flex min-h-svh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 45% at 50% -5%, color-mix(in oklch, var(--primary) 14%, transparent), transparent), linear-gradient(180deg, color-mix(in oklch, var(--background) 92%, #0c1218) 0%, var(--background) 40%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <AuthBrand />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
