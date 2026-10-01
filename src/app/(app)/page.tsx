import { TodayTabs } from "@/components/today-tabs";
import { ensureDb } from "@/db/ensure";
import { listDailyJobs } from "@/modules/jobs/queries";
import { toJobTriageRow } from "@/modules/jobs/to-triage-row";
import { listDailyLeads } from "@/modules/leads/queries";
import { getTodayMode, getUserSettings } from "@/modules/settings/user-settings";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";
import { clientsModeEnabled } from "@/modules/onboarding/clients-mode";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const { first } = await searchParams;
  await ensureDb();
  const clientsEnabled = await clientsModeEnabled();
  const [leadRows, jobRows, mode, hasSearchProfile] = await Promise.all([
    clientsEnabled
      ? getUserSettings().then((settings) =>
          listDailyLeads(settings.dailyLeadCount ?? 12),
        )
      : [],
    listDailyJobs(),
    clientsEnabled ? getTodayMode() : ("jobs" as const),
    getApprovedSearchProfile().then(Boolean),
  ]);

  return (
    <TodayTabs
      mode={mode}
      clientsEnabled={clientsEnabled}
      hasSearchProfile={hasSearchProfile}
      autoSearch={first === "1"}
      jobRows={jobRows.map(toJobTriageRow)}
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
