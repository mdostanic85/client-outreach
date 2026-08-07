"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendApplicationPackageAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

  useEffect(() => {
    if (!open) return;
    setTo(initialEmail.to);
    setSubject(initialEmail.subject);
    setBody(initialEmail.body);
    setError(null);
  }, [open, initialEmail]);

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:sm:max-w-lg w-full gap-0 p-0"
      >
        <SheetHeader className="border-border border-b px-5 py-4">
          <SheetTitle className="font-display text-[20px] font-semibold tracking-tight">
            Send application
          </SheetTitle>
          <SheetDescription>
            {jobTitle} · {companyName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {!mailboxConnected ? (
            <p className="text-destructive rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[14px]">
              No mailbox connected.{" "}
              <a href="/admin?tab=mail" className="underline">
                Connect in Admin
              </a>
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[14px]">
              {error}
            </p>
          ) : null}

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
              className="min-h-[280px] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t px-5 py-4">
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
