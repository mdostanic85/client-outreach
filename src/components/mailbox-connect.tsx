"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  disconnectMailboxAction,
  saveOtherMailboxAction,
  saveGoogleOauthClientAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MailboxConnectionStatus } from "@/modules/mail/oauth-google";

type Expand = null | "gmail-setup" | "other";

export function MailboxConnect({
  status,
  flash,
}: {
  status: MailboxConnectionStatus;
  flash?: { kind: "connected" | "error"; message: string } | null;
}) {
  const router = useRouter();
  const [expand, setExpand] = useState<Expand>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [imapPort, setImapPort] = useState("993");

  useEffect(() => {
    if (!flash) return;
    if (flash.kind === "connected") {
      setInfo(`Connected: ${flash.message}`);
      setError(null);
    } else {
      setError(flash.message);
      setInfo(null);
    }
  }, [flash]);

  const disconnect = () => {
    if (!window.confirm("Disconnect this mailbox?")) return;
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await disconnectMailboxAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInfo("Disconnected.");
      setExpand(null);
      router.refresh();
    });
  };

  const saveOauthClient = () => {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await saveGoogleOauthClientAction(clientId, clientSecret);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setClientId("");
      setClientSecret("");
      setInfo("Google app saved. Connect Gmail now.");
      setExpand(null);
      router.refresh();
    });
  };

  const saveOther = () => {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await saveOtherMailboxAction({
        email,
        password,
        smtpHost,
        imapHost,
        smtpPort,
        imapPort,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPassword("");
      setInfo("Connected.");
      setExpand(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {info ? (
        <p className="bg-muted/40 text-[14px] rounded-xl px-4 py-3">{info}</p>
      ) : null}
      {error ? (
        <p className="text-destructive border-destructive/20 bg-destructive/5 rounded-xl border px-4 py-3 text-[14px]">
          {error}
        </p>
      ) : null}

      {status.connected ? (
        <div className="border-border divide-border divide-y rounded-2xl border">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[15px] font-medium">{status.email}</p>
                <Badge variant="secondary">Connected</Badge>
              </div>
              <p className="text-muted-foreground text-[14px]">
                {status.mode === "oauth"
                  ? "Gmail · signed in with Google"
                  : "Other email · SMTP + IMAP"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={disconnect}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-border divide-border divide-y rounded-2xl border">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-[15px] font-medium">Gmail</p>
                <p className="text-muted-foreground text-[14px]">
                  Sign in with Google — one click.
                </p>
              </div>
              {status.googleOauthReady ? (
                <a
                  href="/api/mail/oauth/google/start"
                  className="bg-primary text-primary-foreground hover:bg-primary/85 pressable inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-[14px] font-medium"
                >
                  Connect
                </a>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setExpand(expand === "gmail-setup" ? null : "gmail-setup")
                  }
                >
                  {expand === "gmail-setup" ? "Hide setup" : "Set up"}
                </Button>
              )}
            </div>

            {expand === "gmail-setup" && !status.googleOauthReady ? (
              <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                <p className="text-muted-foreground text-[13px] leading-relaxed">
                  One-time: Google Cloud → OAuth client (Web). Redirect URI must
                  match this app, e.g.{" "}
                  <code className="text-[12px]">
                    http://127.0.0.1:3003/api/mail/oauth/google/callback
                  </code>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="oauth-client-id">Client ID</Label>
                  <Input
                    id="oauth-client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="….apps.googleusercontent.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oauth-client-secret">Client secret</Label>
                  <Input
                    id="oauth-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-…"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !clientId.trim() || !clientSecret.trim()}
                  onClick={saveOauthClient}
                >
                  Save & continue
                </Button>
              </div>
            ) : null}
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-[15px] font-medium">Other email</p>
                <p className="text-muted-foreground text-[14px]">
                  Username, password, SMTP + IMAP.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpand(expand === "other" ? null : "other")}
              >
                {expand === "other" ? "Hide" : "Connect"}
              </Button>
            </div>

            {expand === "other" ? (
              <div className="mt-4 max-w-lg space-y-3 border-t border-[var(--border)] pt-4">
                <div className="space-y-2">
                  <Label htmlFor="mail-email">Email</Label>
                  <Input
                    id="mail-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail-password">Password</Label>
                  <Input
                    id="mail-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mailbox or app password"
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail-smtp">SMTP (outgoing)</Label>
                  <Input
                    id="mail-smtp"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail-imap">IMAP (incoming)</Label>
                  <Input
                    id="mail-imap"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder="imap.example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="mail-smtp-port">SMTP port</Label>
                    <Input
                      id="mail-smtp-port"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="465"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mail-imap-port">IMAP port</Label>
                    <Input
                      id="mail-imap-port"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      placeholder="993"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    pending ||
                    !email.trim() ||
                    !password.trim() ||
                    !smtpHost.trim() ||
                    !imapHost.trim()
                  }
                  onClick={saveOther}
                >
                  Save & connect
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
