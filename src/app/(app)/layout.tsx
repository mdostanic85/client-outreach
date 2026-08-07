import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ensureDb } from "@/db/ensure";
import { getBudgetStatus } from "@/lib/budgets";
import { getNavCounts } from "@/lib/nav-counts";
import { countUsers, getSessionUser } from "@/modules/auth/session";
import { maybeBackfillOnboardingComplete } from "@/modules/onboarding/state";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) {
    redirect((await countUsers()) === 0 ? "/welcome" : "/login");
  }

  if (
    !user.onboardingCompletedAt &&
    !(await maybeBackfillOnboardingComplete(user.id))
  ) {
    redirect("/onboarding");
  }

  const [counts, budget] = await Promise.all([
    getNavCounts(),
    getBudgetStatus(),
  ]);

  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-svh">
        <AppSidebar
          leadsCount={counts.leadsCount}
          queueCount={counts.queueCount}
          interestedCount={counts.interestedCount}
          profileFitCount={counts.profileFitCount}
        />
        <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
          <AppTopbar
            budget={{
              spentUsd: budget.spentUsd,
              budgetUsd: budget.budgetUsd,
              hardStopped: budget.hardStopped,
              alert: budget.alerts[0],
            }}
            userEmail={user.email}
            leadsCount={counts.leadsCount}
            queueCount={counts.queueCount}
            interestedCount={counts.interestedCount}
            profileFitCount={counts.profileFitCount}
          />
          {children}
        </div>
      </div>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}
