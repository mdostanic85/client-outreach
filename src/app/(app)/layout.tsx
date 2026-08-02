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
  ensureDb();
  const user = await getSessionUser();
  if (!user) {
    redirect(countUsers() === 0 ? "/welcome" : "/login");
  }

  if (!maybeBackfillOnboardingComplete(user.id)) {
    redirect("/onboarding");
  }

  const { leadsCount, queueCount, interestedCount } = getNavCounts();
  const budget = getBudgetStatus();

  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-svh">
        <AppSidebar
          leadsCount={leadsCount}
          queueCount={queueCount}
          interestedCount={interestedCount}
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
            leadsCount={leadsCount}
            queueCount={queueCount}
            interestedCount={interestedCount}
          />
          {children}
        </div>
      </div>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}
