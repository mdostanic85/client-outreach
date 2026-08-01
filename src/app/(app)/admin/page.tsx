import { getAdminOverview, getSettingsRow } from "@/modules/leads/queries";
import {
  PageHeader,
  PageShell,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { PrivacyControls } from "@/components/privacy-controls";
import { ReadinessPanel } from "@/components/readiness-panel";
import { SecretsStatus } from "@/components/secrets-status";
import { ensureDb } from "@/db/ensure";
import {
  getSecretsStatus,
  keychainServiceName,
} from "@/lib/security/secrets";
import {
  getValidationReadiness,
  parseOpsChecklist,
} from "@/modules/ops/readiness";

export const dynamic = "force-dynamic";

function formatStatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default function AdminPage() {
  ensureDb();
  const admin = getAdminOverview();
  const settings = getSettingsRow();
  const ops = parseOpsChecklist(settings?.opsChecklistJson);
  const readiness = getValidationReadiness(ops);
  const secrets = getSecretsStatus();
  const service = keychainServiceName();
  const stats = admin.latestRun
    ? (JSON.parse(admin.latestRun.statsJson || "{}") as Record<string, unknown>)
    : {};
  const statEntries = Object.entries(stats);
  const missingSecrets = secrets.filter((s) => !s.present);
  const missingLlm = missingSecrets
    .filter(
      (s) => s.name === "GOOGLE_API_KEY" || s.name === "ANTHROPIC_API_KEY",
    )
    .map((s) => s.name);
  const budgetPct =
    admin.budget.budgetUsd > 0
      ? Math.min(
          100,
          Math.round((admin.budget.spentUsd / admin.budget.budgetUsd) * 100),
        )
      : 0;
  const actionItems = [
    ...missingLlm.map((name) => `Missing LLM secret: ${name}`),
    ...admin.manualActions,
  ];

  return (
    <PageShell>
      <PageHeader
        title="Admin"
        description="Credentials, run health, funnel counts, and cost meter."
        meta={
          missingSecrets.length > 0
            ? `${missingSecrets.length} credentials need attention`
            : "Credentials configured"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Surface>
          <PanelBody className="space-y-2 py-6">
            <p className="text-muted-foreground text-[13px] font-medium tracking-wide">
              Credentials
            </p>
            <p className="font-display tabular text-[28px] font-semibold tracking-tight">
              {secrets.length - missingSecrets.length}
              <span className="text-muted-foreground text-[15px] font-normal">
                /{secrets.length}
              </span>
            </p>
            <p className="text-muted-foreground text-[13px]">
              {missingSecrets.length === 0
                ? "All keys present"
                : `${missingSecrets.length} missing`}
            </p>
          </PanelBody>
        </Surface>

        <Surface>
          <PanelBody className="space-y-2 py-6">
            <p className="text-muted-foreground text-[13px] font-medium tracking-wide">
              AI budget
            </p>
            <p className="font-display tabular text-[28px] font-semibold tracking-tight">
              ${admin.budget.spentUsd.toFixed(3)}
              <span className="text-muted-foreground text-[15px] font-normal">
                / ${admin.budget.budgetUsd}
              </span>
            </p>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-foreground h-full rounded-full transition-[width]"
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </PanelBody>
        </Surface>

        <Surface>
          <PanelBody className="space-y-2 py-6">
            <p className="text-muted-foreground text-[13px] font-medium tracking-wide">
              Latest run
            </p>
            <p className="font-display text-[22px] font-semibold tracking-tight">
              {admin.latestRun?.finishedAt
                ? "Finished"
                : admin.latestRun
                  ? "In progress"
                  : "None yet"}
            </p>
            <p className="text-muted-foreground truncate text-[13px]">
              {admin.latestRun
                ? `Started ${admin.latestRun.startedAt}`
                : "Run the daily pipeline from Today"}
            </p>
          </PanelBody>
        </Surface>

        <Surface>
          <PanelBody className="space-y-2 py-6">
            <p className="text-muted-foreground text-[13px] font-medium tracking-wide">
              Needs action
            </p>
            <p className="font-display tabular text-[28px] font-semibold tracking-tight">
              {actionItems.length}
            </p>
            <p className="text-muted-foreground text-[13px]">
              {actionItems.length === 0
                ? "Nothing outstanding"
                : "See list below"}
            </p>
          </PanelBody>
        </Surface>
      </div>

      <Surface>
        <PanelHeader>
          <SectionTitle
            title="API keys & credentials"
            description="Paste provider keys and mailbox credentials. Values stay in Keychain or .env."
          />
        </PanelHeader>
        <PanelBody>
          <SecretsStatus initialSecrets={secrets} service={service} />
        </PanelBody>
      </Surface>

      <div className="grid gap-8 lg:grid-cols-2">
        <Surface>
          <PanelHeader>
            <SectionTitle title="Latest run" />
          </PanelHeader>
          <PanelBody>
            {admin.latestRun ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="text-muted-foreground font-mono text-[13px]">
                    {admin.latestRun.id}
                  </p>
                  <p className="text-[15px]">
                    Started {admin.latestRun.startedAt}
                  </p>
                  <p className="text-[15px]">
                    Finished:{" "}
                    {admin.latestRun.finishedAt ?? (
                      <span className="text-destructive">not finished</span>
                    )}
                  </p>
                </div>
                {admin.latestRun.error ? (
                  <p className="text-destructive rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[14px]">
                    {admin.latestRun.error}
                  </p>
                ) : null}
                {statEntries.length > 0 ? (
                  <ul className="divide-border divide-y text-[14px]">
                    {statEntries.map(([key, value]) => (
                      <li
                        key={key}
                        className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span className="text-muted-foreground">{key}</span>
                        <span className="tabular font-medium">
                          {formatStatValue(value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-[14px]">
                    No run stats recorded.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-[15px]">
                Run the daily pipeline from Today.
              </p>
            )}
          </PanelBody>
        </Surface>

        <Surface>
          <PanelHeader>
            <SectionTitle title="Budget & usage" />
          </PanelHeader>
          <PanelBody>
            <div className="flex flex-wrap items-center gap-2">
              {admin.budget.alerts.map((a) => (
                <Badge key={a} variant="destructive">
                  {a}
                </Badge>
              ))}
              {admin.budget.alerts.length === 0 ? (
                <Badge variant="secondary">Within budget</Badge>
              ) : null}
            </div>
            {admin.usageByTask.length === 0 ? (
              <p className="text-muted-foreground text-[14px]">
                No AI usage logged yet.
              </p>
            ) : (
              <ul className="divide-border divide-y text-[14px]">
                {admin.usageByTask.map((u) => (
                  <li
                    key={`${u.task}-${u.provider}`}
                    className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-muted-foreground">
                      {u.task} · {u.provider}
                    </span>
                    <span className="tabular font-medium">
                      ${Number(u.cost).toFixed(4)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Surface>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Surface>
          <PanelHeader>
            <SectionTitle title="Lead states" />
          </PanelHeader>
          {admin.stateCounts.length === 0 ? (
            <p className="text-muted-foreground px-8 py-10 text-[15px]">
              No leads yet.
            </p>
          ) : (
            <ul className="grid gap-0 text-[15px] sm:grid-cols-2">
              {admin.stateCounts.map((s) => (
                <li
                  key={s.state}
                  className="border-border flex justify-between gap-4 border-b px-8 py-4"
                >
                  <span>{s.state}</span>
                  <span className="tabular font-semibold">
                    {Number(s.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface>
          <PanelHeader>
            <SectionTitle title="Reject reasons" />
          </PanelHeader>
          {admin.rejectReasons.length === 0 ? (
            <p className="text-muted-foreground px-8 py-10 text-[15px]">
              None yet.
            </p>
          ) : (
            <ul className="divide-border divide-y text-[15px]">
              {admin.rejectReasons.map((r) => (
                <li
                  key={r.reason ?? "null"}
                  className="flex justify-between gap-4 px-8 py-4"
                >
                  <span>{r.reason ?? "(empty)"}</span>
                  <span className="tabular font-semibold">
                    {Number(r.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      <Surface>
        <PanelHeader>
          <SectionTitle title="Needs manual action" />
        </PanelHeader>
        {actionItems.length === 0 ? (
          <p className="text-muted-foreground px-8 py-10 text-[15px]">
            Nothing outstanding.
          </p>
        ) : (
          <ul className="list-disc space-y-3 px-12 py-8 text-[15px]">
            {actionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface>
        <PanelHeader>
          <SectionTitle
            title="Validation readiness"
            description="Phase checklist for outreach quality and mailbox ops."
          />
        </PanelHeader>
        <PanelBody>
          <ReadinessPanel
            phase1={readiness.phase1}
            phase2={readiness.phase2}
            phase3Ops={readiness.phase3Ops}
            phase4Gates={readiness.phase4Gates}
            ops={ops}
          />
        </PanelBody>
      </Surface>

      <Surface>
        <PanelHeader>
          <SectionTitle title="Privacy — export & retention" />
        </PanelHeader>
        <PanelBody>
          <PrivacyControls />
        </PanelBody>
      </Surface>
    </PageShell>
  );
}
