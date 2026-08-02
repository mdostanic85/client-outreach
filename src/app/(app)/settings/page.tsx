import { SettingsForm } from "@/components/settings-form";
import { PageHeader, PageShell } from "@/components/page-shell";
import { getSettingsRow } from "@/modules/leads/queries";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const row = getSettingsRow();
  if (!row) {
    return (
      <PageShell width="setup">
        <p className="text-muted-foreground text-sm">Settings not initialized.</p>
      </PageShell>
    );
  }

  return (
    <PageShell width="setup">
      <PageHeader
        title="Outreach voice"
        description="Short positioning and writing style for cold emails. This is not your job-matching Profile."
      />
      <SettingsForm
        initial={{
          profileMd: row.profileMd,
          styleProfileJson: row.styleProfileJson,
          targetFiltersJson: row.targetFiltersJson,
          countryPolicyJson: row.countryPolicyJson,
          sendPolicyJson: row.sendPolicyJson,
          dailyLeadCount: row.dailyLeadCount,
          aiBudgetUsd: row.aiBudgetUsd,
        }}
      />
    </PageShell>
  );
}
