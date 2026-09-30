"use client";

import { useMemo, useState } from "react";
import { MailboxConnect } from "@/components/mailbox-connect";
import { PrivacyControls } from "@/components/privacy-controls";
import { ReadinessPanel } from "@/components/readiness-panel";
import { SecretsStatus } from "@/components/secrets-status";
import { SegmentedControl } from "@/components/segmented-control";
import { Badge } from "@/components/ui/badge";
import type { SecretSource, TrackedSecret } from "@/lib/security/secrets";
import type { MailboxConnectionStatus } from "@/modules/mail/oauth-google";
import type { OpsChecklist, ValidationReadiness } from "@/modules/ops/readiness";

type Tab = "mail" | "keys" | "status" | "privacy";

type SecretRow = TrackedSecret & { source: SecretSource; present: boolean };

type AdminWorkspaceProps = {
  mailbox: MailboxConnectionStatus;
  mailboxFlash?: { kind: "connected" | "error"; message: string } | null;
  secrets: SecretRow[];
  service: string;
  budget: {
    spentUsd: number;
    budgetUsd: number;
    alerts: string[];
  };
  latestRun: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  } | null;
  runStats: Array<[string, string]>;
  usageByTask: Array<{ task: string; provider: string; cost: number }>;
  actionItems: string[];
  stateCounts: Array<{ state: string; count: number }>;
  rejectReasons: Array<{ reason: string | null; count: number }>;
  readiness: ValidationReadiness;
  ops: OpsChecklist;
  initialTab?: Tab;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "mail", label: "Mailbox" },
  { id: "keys", label: "API keys" },
  { id: "status", label: "Status" },
  { id: "privacy", label: "Privacy" },
];

export function AdminWorkspace(props: AdminWorkspaceProps) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? "mail");

  const missingKeys = useMemo(
    () => props.secrets.filter((s) => !s.present).length,
    [props.secrets],
  );

  const tabOptions = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count:
      t.id === "keys" && missingKeys > 0
        ? missingKeys
        : t.id === "status" && props.actionItems.length > 0
          ? props.actionItems.length
          : undefined,
  }));

  return (
    <div className="space-y-8">
      <SegmentedControl
        options={tabOptions}
        value={tab}
        onChange={setTab}
        ariaLabel="Admin sections"
      />

      {tab === "mail" ? (
        <section className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-h5 font-medium">
              Mailbox
            </h2>
            <p className="text-muted-foreground max-w-xl text-body leading-relaxed">
              Where Optra sends mail and reads replies.
            </p>
          </header>
          <MailboxConnect status={props.mailbox} flash={props.mailboxFlash} />
        </section>
      ) : null}

      {tab === "keys" ? (
        <section className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-h5 font-medium">
              API keys
            </h2>
            <p className="text-muted-foreground max-w-xl text-body leading-relaxed">
              Models and job collectors. Stored in Keychain or{" "}
              <code className="text-body-sm">.env</code>.
            </p>
          </header>
          <SecretsStatus
            initialSecrets={props.secrets}
            service={props.service}
            compact
          />
        </section>
      ) : null}

      {tab === "status" ? (
        <section className="space-y-8">
          <header className="space-y-1">
            <h2 className="text-h5 font-medium">
              Status
            </h2>
            <p className="text-muted-foreground max-w-xl text-body leading-relaxed">
              Budget, last pipeline run, and what still needs attention.
            </p>
          </header>

          <div className="bg-card shadow-card divide-y divide-border rounded-card in-[.bg-card]:bg-subtle in-[.bg-card]:shadow-none">
            <StatusRow
              label="Mailbox"
              value={
                props.mailbox.connected
                  ? props.mailbox.email ?? "Connected"
                  : "Not connected"
              }
              ok={props.mailbox.connected}
            />
            <StatusRow
              label="API keys"
              value={
                missingKeys === 0
                  ? "All set"
                  : `${missingKeys} missing`
              }
              ok={missingKeys === 0}
            />
            <StatusRow
              label="AI budget"
              value={`$${props.budget.spentUsd.toFixed(3)} / $${props.budget.budgetUsd}`}
              ok={props.budget.alerts.length === 0}
            />
            <StatusRow
              label="Latest run"
              value={
                props.latestRun?.finishedAt
                  ? "Finished"
                  : props.latestRun
                    ? "In progress"
                    : "None yet"
              }
              ok={!props.latestRun?.error}
            />
          </div>

          {props.actionItems.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-body font-medium">Needs attention</h3>
              <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-body">
                {props.actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {props.budget.alerts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {props.budget.alerts.map((a) => (
                <Badge key={a} variant="destructive">
                  {a}
                </Badge>
              ))}
            </div>
          ) : null}

          {props.usageByTask.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-body font-medium">Usage by task</h3>
              <ul className="bg-card shadow-card divide-y divide-border rounded-card in-[.bg-card]:bg-subtle in-[.bg-card]:shadow-none text-body-sm">
                {props.usageByTask.map((u) => (
                  <li
                    key={`${u.task}-${u.provider}`}
                    className="flex justify-between gap-4 px-5 py-3"
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
            </div>
          ) : null}

          {props.latestRun ? (
            <details className="bg-subtle rounded-panel">
              <summary className="cursor-pointer px-5 py-4 text-body font-medium select-none">
                Last run details
              </summary>
              <div className="border-border space-y-4 border-t px-5 py-4 text-body-sm">
                <p className="text-muted-foreground font-mono text-body-sm">
                  {props.latestRun.id}
                </p>
                <p>Started {props.latestRun.startedAt}</p>
                <p>
                  Finished:{" "}
                  {props.latestRun.finishedAt ?? (
                    <span className="text-destructive">not finished</span>
                  )}
                </p>
                {props.latestRun.error ? (
                  <p className="text-destructive">{props.latestRun.error}</p>
                ) : null}
                {props.runStats.length > 0 ? (
                  <ul className="divide-border divide-y">
                    {props.runStats.map(([key, value]) => (
                      <li
                        key={key}
                        className="flex justify-between gap-4 py-2.5"
                      >
                        <span className="text-muted-foreground">{key}</span>
                        <span className="tabular font-medium">{value}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          ) : null}

          <details className="bg-subtle rounded-panel">
            <summary className="cursor-pointer px-5 py-4 text-body font-medium select-none">
              Advanced diagnostics
            </summary>
            <div className="border-border space-y-8 border-t p-5">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-body font-medium">Lead states</h3>
                  {props.stateCounts.length === 0 ? (
                    <p className="text-muted-foreground text-body-sm">No leads yet.</p>
                  ) : (
                    <ul className="bg-subtle divide-y divide-border rounded-panel text-body-sm">
                      {props.stateCounts.map((s) => (
                        <li
                          key={s.state}
                          className="flex justify-between gap-4 px-4 py-2.5"
                        >
                          <span>{s.state}</span>
                          <span className="tabular font-medium">
                            {s.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-3">
                  <h3 className="text-body font-medium">Reject reasons</h3>
                  {props.rejectReasons.length === 0 ? (
                    <p className="text-muted-foreground text-body-sm">None yet.</p>
                  ) : (
                    <ul className="bg-subtle divide-y divide-border rounded-panel text-body-sm">
                      {props.rejectReasons.map((r) => (
                        <li
                          key={r.reason ?? "null"}
                          className="flex justify-between gap-4 px-4 py-2.5"
                        >
                          <span>{r.reason ?? "(empty)"}</span>
                          <span className="tabular font-medium">
                            {r.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-body font-medium">Validation readiness</h3>
                <ReadinessPanel
                  phase1={props.readiness.phase1}
                  phase2={props.readiness.phase2}
                  phase3Ops={props.readiness.phase3Ops}
                  phase4Gates={props.readiness.phase4Gates}
                  ops={props.ops}
                />
              </div>
            </div>
          </details>
        </section>
      ) : null}

      {tab === "privacy" ? (
        <section className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-h5 font-medium">
              Privacy
            </h2>
            <p className="text-muted-foreground max-w-xl text-body leading-relaxed">
              Export and delete personal data. Always available.
            </p>
          </header>
          <PrivacyControls />
        </section>
      ) : null}
    </div>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          className={
            ok
              ? "bg-brand size-2 rounded-full"
              : "bg-warn size-2 rounded-full"
          }
          aria-hidden
        />
        <span className="text-body font-medium">{label}</span>
      </div>
      <span className="text-muted-foreground text-body-sm">{value}</span>
    </div>
  );
}
