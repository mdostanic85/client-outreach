import { SettingsForm } from "@/components/settings-form";
import { PageHeader, PageShell } from "@/components/page-shell";
import { getSettingsRow } from "@/modules/leads/queries";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const row = getSettingsRow();
  if (!row) {
    return (
      <PageShell width="form">
        <p className="text-muted-foreground text-sm">Settings not initialized.</p>
      </PageShell>
    );
  }

  return (
    <PageShell width="form">
      <PageHeader
        title="Outreach style"
        description="How Optra writes cold emails. Short tone notes work better than long rules."
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
