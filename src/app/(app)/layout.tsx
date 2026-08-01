import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
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

  const { leadsCount, queueCount } = getNavCounts();
  const budget = getBudgetStatus();
  const budgetLabel = `AI $${budget.spentUsd.toFixed(0)} / $${budget.budgetUsd}${
    budget.alerts.length ? ` · ${budget.alerts[0]}` : ""
  }`;

  return (
    <div className="flex min-h-svh">
      <AppSidebar
        leadsCount={leadsCount}
        queueCount={queueCount}
        budgetLabel={budgetLabel}
        userEmail={user.email}
      />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
