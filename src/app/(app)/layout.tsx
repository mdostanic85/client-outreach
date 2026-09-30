import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { JobSearchProvider } from "@/components/job-search-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ensureDb } from "@/db/ensure";
import { getBudgetStatus } from "@/lib/budgets";
import { getNavCounts } from "@/lib/nav-counts";
import { getJobSearchStatus } from "@/modules/jobs/queries";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";
import { getSessionUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) {
    redirect("/welcome");
  }

  if (!user.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const [counts, budget, searchStatus] = await Promise.all([
    getNavCounts(),
    getBudgetStatus(),
    getApprovedSearchProfile().then((profile) =>
      getJobSearchStatus(Boolean(profile)),
    ),
  ]);

  return (
    <TooltipProvider delay={200}>
      <JobSearchProvider>
        <div className="flex min-h-svh">
          <AppSidebar
            queueCount={counts.queueCount}
            interestedCount={counts.interestedCount}
            profileFitCount={counts.profileFitCount}
            isOwner={counts.isOwner}
          />
          <div className="flex min-h-svh min-w-0 flex-1 flex-col">
            <AppTopbar
              budget={
                counts.isOwner
                  ? {
                      spentUsd: budget.spentUsd,
                      budgetUsd: budget.budgetUsd,
                      hardStopped: budget.hardStopped,
                      alert: budget.alerts[0],
                    }
                  : undefined
              }
              userEmail={user.email}
              searchStatus={searchStatus}
              isOwner={counts.isOwner}
              queueCount={counts.queueCount}
              interestedCount={counts.interestedCount}
              profileFitCount={counts.profileFitCount}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
              {children}
            </div>
          </div>
        </div>
      </JobSearchProvider>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}
