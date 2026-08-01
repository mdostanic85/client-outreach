import { SettingsForm } from "@/components/settings-form";
import { PageShell, SectionTitle } from "@/components/page-shell";
import { getSettingsRow } from "@/modules/leads/queries";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const row = getSettingsRow();
  if (!row) {
    return (
      <PageShell width="form" className="gap-6 lg:gap-8">
        <p className="text-muted-foreground text-sm">Settings not initialized.</p>
      </PageShell>
    );
  }

  return (
    <PageShell width="form" className="gap-6 lg:gap-8">
      <SectionTitle
        title="Outreach voice"
        description="Tone and proof points for cold emails. Keep notes short and specific."
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
