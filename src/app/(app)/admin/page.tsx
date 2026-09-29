import { getAdminOverview, getSettingsRow } from "@/modules/leads/queries";
import { AdminWorkspace } from "@/components/admin-workspace";
import { PageHeader, PageShell } from "@/components/page-shell";
import { ensureDb } from "@/db/ensure";
import {
  getSecretsStatus,
  keychainServiceName,
  MAILBOX_SECRET_NAMES,
} from "@/lib/security/secrets";
import { getMailboxConnectionStatus } from "@/modules/mail/oauth-google";
import {
  getValidationReadiness,
  parseOpsChecklist,
} from "@/modules/ops/readiness";
import { requireOwnerPage } from "@/modules/auth/page-guards";

export const dynamic = "force-dynamic";

function formatStatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwnerPage();
  await ensureDb();
  const params = (await searchParams) ?? {};
  const mailboxParam =
    typeof params.mailbox === "string" ? params.mailbox : null;
  const mailboxMessage =
    typeof params.message === "string" ? params.message : "";
  const mailboxFlash =
    mailboxParam === "connected" || mailboxParam === "error"
      ? {
          kind: mailboxParam as "connected" | "error",
          message:
            mailboxMessage ||
            (mailboxParam === "connected" ? "Connected" : "Error"),
        }
      : null;

  const tabParam = typeof params.tab === "string" ? params.tab : null;
  const initialTab =
    tabParam === "keys" ||
    tabParam === "status" ||
    tabParam === "privacy" ||
    tabParam === "mail"
      ? tabParam
      : mailboxFlash
        ? "mail"
        : "mail";

  const admin = await getAdminOverview();
  const settings = await getSettingsRow();
  const ops = parseOpsChecklist(settings?.opsChecklistJson);
  const readiness = await getValidationReadiness(ops);
  const secrets = getSecretsStatus().filter(
    (s) => !MAILBOX_SECRET_NAMES.has(s.name),
  );
  const mailbox = getMailboxConnectionStatus();
  const service = keychainServiceName();
  const stats = admin.latestRun
    ? (JSON.parse(admin.latestRun.statsJson || "{}") as Record<string, unknown>)
    : {};
  const runStats = Object.entries(stats).map(
    ([key, value]) => [key, formatStatValue(value)] as [string, string],
  );
  const missingSecrets = secrets.filter((s) => !s.present);
  const missingLlm = missingSecrets
    .filter(
      (s) => s.name === "GOOGLE_API_KEY" || s.name === "ANTHROPIC_API_KEY",
    )
    .map((s) => s.name);
  const actionItems = [
    ...missingLlm.map((name) => `Missing LLM secret: ${name}`),
    ...(!mailbox.connected ? ["Mailbox not connected"] : []),
    ...admin.manualActions,
  ];

  return (
    <PageShell>
      <PageHeader
        title="Admin"
        description="Mailbox, keys, and privacy — one section at a time."
        meta={
          !mailbox.connected
            ? "Connect a mailbox to send"
            : missingSecrets.length > 0
              ? `${missingSecrets.length} keys missing`
              : "Ready"
        }
      />

      <AdminWorkspace
        initialTab={initialTab}
        mailbox={mailbox}
        mailboxFlash={mailboxFlash}
        secrets={secrets}
        service={service}
        budget={admin.budget}
        latestRun={
          admin.latestRun
            ? {
                id: admin.latestRun.id,
                startedAt: admin.latestRun.startedAt,
                finishedAt: admin.latestRun.finishedAt,
                error: admin.latestRun.error,
              }
            : null
        }
        runStats={runStats}
        usageByTask={admin.usageByTask.map((u) => ({
          task: u.task,
          provider: u.provider,
          cost: Number(u.cost),
        }))}
        actionItems={actionItems}
        stateCounts={admin.stateCounts.map((s) => ({
          state: s.state,
          count: Number(s.count),
        }))}
        rejectReasons={admin.rejectReasons.map((r) => ({
          reason: r.reason,
          count: Number(r.count),
        }))}
        readiness={readiness}
        ops={ops}
      />
    </PageShell>
  );
}
