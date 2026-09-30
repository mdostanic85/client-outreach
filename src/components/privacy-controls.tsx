"use client";

import { useState, useTransition } from "react";
import {
  deleteContactAction,
  exportPersonalDataAction,
  runRetentionPruneAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PrivacyControls() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [contactId, setContactId] = useState("");

  return (
    <div className="space-y-4 text-body-sm">
      <p className="text-muted-foreground">
        Export and deletion are always available (not blocked by AI budget).
        Suppressions are never removed by retention.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await exportPersonalDataAction();
              setMessage(
                res.ok
                  ? `Exported ${res.data.bytes} bytes → ${res.data.path}`
                  : res.error,
              );
            })
          }
        >
          Export all personal data
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await runRetentionPruneAction(true);
              setMessage(
                res.ok
                  ? `Dry run: reject=${res.data.rejectedLeadContactsDeleted.length}, never=${res.data.neverContactedDeleted.length}, raw=${res.data.rawSignalsCleared.length}`
                  : res.error,
              );
            })
          }
        >
          Retention dry run
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (
                !window.confirm(
                  "Permanently prune contacts older than 30 days (rejected / never-contacted) and clear 90-day raw signals?",
                )
              ) {
                return;
              }
              const res = await runRetentionPruneAction(false);
              setMessage(
                res.ok
                  ? `Pruned: reject=${res.data.rejectedLeadContactsDeleted.length}, never=${res.data.neverContactedDeleted.length}, raw=${res.data.rawSignalsCleared.length}`
                  : res.error,
              );
            })
          }
        >
          Run retention prune
        </Button>
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="delete-contact-id">Delete contact by ID</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="delete-contact-id"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            placeholder="ct_…"
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || !contactId.trim()}
            onClick={() =>
              start(async () => {
                const res = await deleteContactAction(contactId.trim());
                setMessage(
                  res.ok
                    ? res.data.deleted
                      ? `Deleted ${contactId}`
                      : res.data.reason ?? "Not deleted"
                    : res.error,
                );
              })
            }
          >
            Delete
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !contactId.trim()}
            onClick={() =>
              start(async () => {
                if (
                  !window.confirm(
                    "Force delete even if correspondence exists (messages kept, PII removed)?",
                  )
                ) {
                  return;
                }
                const res = await deleteContactAction(contactId.trim(), true);
                setMessage(
                  res.ok
                    ? res.data.deleted
                      ? `Force-deleted ${contactId}`
                      : res.data.reason ?? "Not deleted"
                    : res.error,
                );
              })
            }
          >
            Force delete
          </Button>
        </div>
      </div>

      {message ? (
        <p className="bg-subtle break-all rounded-tile p-3 text-body-sm">{message}</p>
      ) : null}
    </div>
  );
}
