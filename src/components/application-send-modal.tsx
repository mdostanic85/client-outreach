"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendApplicationPackageAction } from "@/modules/applications/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineAlert } from "@/components/inline-alert";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationEmailDraft } from "@/modules/applications/application-email";

export function ApplicationSendModal({
  open,
  onOpenChange,
  packageId,
  companyName,
  jobTitle,
  fromEmail,
  initialEmail,
  mailboxConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  companyName: string;
  jobTitle: string;
  fromEmail: string | null;
  initialEmail: ApplicationEmailDraft;
  mailboxConnected: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState(initialEmail.to);
  const [subject, setSubject] = useState(initialEmail.subject);
  const [body, setBody] = useState(initialEmail.body);

  // Opening the sheet (or a new package email while open) starts from the package's email.
  const resetKey = open ? `${initialEmail.to}\n${initialEmail.subject}\n${initialEmail.body}` : null;
  const [seenResetKey, setSeenResetKey] = useState(resetKey);
  if (resetKey !== seenResetKey) {
    setSeenResetKey(resetKey);
    if (resetKey !== null) {
      setTo(initialEmail.to);
      setSubject(initialEmail.subject);
      setBody(initialEmail.body);
      setError(null);
    }
  }

  const send = () => {
    setError(null);
    if (!mailboxConnected) {
      setError("Connect a mailbox in Admin first.");
      return;
    }
    start(async () => {
      const res = await sendApplicationPackageAction({
        packageId,
        email: { to, subject, body },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      router.push("/queue?tab=applications");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send application</DialogTitle>
          <DialogDescription>
            {jobTitle} · {companyName}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-6 sm:px-6">
          {!mailboxConnected ? (
            <InlineAlert variant="error">
              No mailbox connected.{" "}
              <a href="/admin?tab=mail" className="underline underline-offset-2">
                Connect in Admin
              </a>
            </InlineAlert>
          ) : null}
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

          <div className="space-y-2">
            <Label htmlFor="send-from">From</Label>
            <Input
              id="send-from"
              value={fromEmail ?? "Mailbox not connected"}
              readOnly
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-to">To</Label>
            <Input
              id="send-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="hiring@company.com"
              autoComplete="off"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-subject">Subject</Label>
            <Input
              id="send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-body">Body</Label>
            <Textarea
              id="send-body"
              className="min-h-[240px] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !mailboxConnected || !to.trim() || !subject.trim() || !body.trim()}
            onClick={send}
          >
            {pending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
