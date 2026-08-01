"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOpsChecklistAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { ChecklistItem, OpsChecklist } from "@/modules/ops/readiness";

function ItemList({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.id} className="flex gap-4 border-b py-2">
          <span className={item.done ? "text-green-700" : "text-muted-foreground"}>
            {item.done ? "✓" : "○"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{item.label}</p>
            <p className="text-muted-foreground text-xs">
              {item.detail}
              {item.source === "manual" ? " · manual" : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const OPS_FIELDS: Array<{ key: keyof OpsChecklist; label: string }> = [
  { key: "productValidated", label: "Product validated" },
  { key: "dedicatedMailbox", label: "Dedicated outreach mailbox" },
  { key: "spfConfirmed", label: "SPF confirmed" },
  { key: "dkimConfirmed", label: "DKIM confirmed" },
  { key: "dmarcReviewed", label: "DMARC published & reviewed" },
  { key: "manualLowVolumePracticed", label: "Manual low-volume practiced" },
];

export function ReadinessPanel({
  phase1,
  phase2,
  phase3Ops,
  phase4Gates,
  ops,
}: {
  phase1: ChecklistItem[];
  phase2: ChecklistItem[];
  phase3Ops: ChecklistItem[];
  phase4Gates: ChecklistItem[];
  ops: OpsChecklist;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(ops);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h3 className="font-medium">Phase 1 — Validation</h3>
        <ItemList items={phase1} />
      </section>
      <section className="space-y-2">
        <h3 className="font-medium">Phase 2 — Draft quality</h3>
        <ItemList items={phase2} />
      </section>
      <section className="space-y-4">
        <h3 className="font-medium">Phase 3 — Mailbox ops (manual)</h3>
        <ItemList items={phase3Ops} />
        <div className="space-y-2 rounded-md border p-3">
          {OPS_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(local[key])}
                disabled={pending}
                onChange={(e) =>
                  setLocal((prev) => ({ ...prev, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
          <textarea
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-xs"
            rows={2}
            placeholder="Notes (unsupported claims %, review time, mailbox address…)"
            value={local.notes ?? ""}
            onChange={(e) =>
              setLocal((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await updateOpsChecklistAction(local);
                setMsg(res.ok ? "Ops checklist saved" : res.error);
                router.refresh();
              })
            }
          >
            Save ops checklist
          </Button>
          {msg ? <p className="text-muted-foreground text-xs">{msg}</p> : null}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="font-medium">Phase 4 — Learning gates</h3>
        <ItemList items={phase4Gates} />
      </section>
    </div>
  );
}
