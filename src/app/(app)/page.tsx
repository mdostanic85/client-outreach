import { TodayTabs } from "@/components/today-tabs";
import { ensureDb } from "@/db/ensure";
import {
  getTodayMode,
  listDailyJobs,
} from "@/modules/jobs/queries";
import { listDailyLeads, getSettingsRow } from "@/modules/leads/queries";
import {
  getSetupChecklistItems,
  isSetupChecklistDismissed,
} from "@/modules/onboarding/state";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";

export const dynamic = "force-dynamic";

export default function HomePage() {
  ensureDb();
  const settings = getSettingsRow();
  const limit = settings?.dailyLeadCount ?? 12;
  const leadRows = listDailyLeads(limit);
  const jobRows = listDailyJobs();
  const mode = getTodayMode();
  const hasSearchProfile = Boolean(getApprovedSearchProfile());
  const showChecklist = !isSetupChecklistDismissed();
  const checklistItems = showChecklist ? getSetupChecklistItems() : [];

  return (
    <TodayTabs
      mode={mode}
      hasSearchProfile={hasSearchProfile}
      checklistItems={checklistItems}
      jobRows={jobRows.map((row) => ({
        jobId: row.job.id,
        title: row.job.title,
        companyName: row.company?.name ?? "Unknown",
        location: row.job.location,
        remotePolicy: row.job.remotePolicy,
        employmentType: row.job.employmentType,
        source: row.job.source,
        sourceUrl: row.job.sourceUrl,
        matchScore: row.match?.matchScore ?? null,
        eligibility: row.match?.eligibility ?? null,
        recommendation: row.match?.recommendation ?? null,
        matchingReasons: row.matchingReasons,
        concerns: row.concerns,
        remoteFit: row.remoteFit,
        mainRisk: row.mainRisk,
        missingRequirements: row.missingRequirements,
        remoteRequired: row.remoteRequired,
        postedAt: row.job.postedAt,
        triageState: row.job.triageState,
      }))}
      leadRows={leadRows.map((row) => ({
        leadId: row.lead.id,
        companyName: row.company.name,
        domain: row.company.domain,
        country: row.company.country,
        score: row.lead.score,
        state: row.lead.state,
        policy: row.policy.policy,
        oneLiner: row.oneLiner,
        topNeed: row.topNeed,
        whyFit: row.whyFit,
        unknowns: row.unknowns,
        sourceTitle: row.sources[0]?.title ?? null,
        sourceUrl: row.sources[0]?.url ?? null,
        sourceName: row.sources[0]?.source ?? null,
        hasBrief: row.hasBrief,
      }))}
    />
  );
}
