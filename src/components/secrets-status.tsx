"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { clearSecretAction, saveSecretAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SecretSource, TrackedSecret } from "@/lib/security/secrets";

type SecretRow = TrackedSecret & { source: SecretSource; present: boolean };

function sourceBadge(source: SecretSource) {
  if (source === "keychain") {
    return <Badge variant="secondary">Keychain</Badge>;
  }
  if (source === "env") {
    return <Badge variant="outline">.env</Badge>;
  }
  return <Badge variant="destructive">Missing</Badge>;
}

function SecretField({
  secret,
  onChanged,
  compact = false,
}: {
  secret: SecretRow;
  onChanged: () => void;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputType =
    secret.inputKind === "password" && !revealed ? "password" : "text";
  const canSave = value.trim().length > 0 && !pending;

  const save = () => {
    if (!canSave) return;
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await saveSecretAction(secret.name, value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValue("");
      setRevealed(false);
      setMessage(
        res.data.source === "keychain"
          ? "Saved to Keychain"
          : "Saved to .env",
      );
      onChanged();
    });
  };

  const clear = () => {
    if (
      !window.confirm(
        `Remove ${secret.label}? The pipeline will stop using this credential until you add it again.`,
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await clearSecretAction(secret.name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValue("");
      setMessage("Cleared");
      onChanged();
    });
  };

  return (
    <li
      className={
        compact
          ? "space-y-3 py-5 first:pt-4 last:pb-4"
          : "border-border space-y-4 border-b py-6 first:pt-0 last:border-b-0 last:pb-0"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-body">{secret.label}</p>
            {sourceBadge(secret.source)}
          </div>
          <p className="text-muted-foreground text-body-sm leading-relaxed">
            {secret.purpose}
          </p>
          {!compact ? (
            <p className="text-muted-foreground font-mono text-body-sm">
              {secret.name}
            </p>
          ) : null}
        </div>
        {secret.docsUrl ? (
          <a
            href={secret.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground inline-flex items-center gap-1.5 text-body-sm underline-offset-4 hover:underline"
          >
            Get key
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`secret-${secret.name}`}>
          {secret.present ? "Replace" : "Paste key"}
        </Label>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-[220px]">
            <Input
              id={`secret-${secret.name}`}
              type={inputType}
              autoComplete="off"
              spellCheck={false}
              value={value}
              disabled={pending}
              placeholder={
                secret.present
                  ? "••••••••••••••••"
                  : (secret.placeholder ?? "Paste value")
              }
              onChange={(e) => {
                setValue(e.target.value);
                setMessage(null);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              className="pr-11 font-mono text-body"
            />
            {secret.inputKind === "password" ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                aria-label={revealed ? "Hide value" : "Show value"}
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            ) : null}
          </div>
          <Button type="button" size="sm" disabled={!canSave} onClick={save}>
            {secret.present ? "Update" : "Save"}
          </Button>
          {secret.present ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={clear}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive text-body-sm">{error}</p>
        ) : null}
        {message ? (
          <p className="text-muted-foreground text-body-sm">{message}</p>
        ) : null}
      </div>
    </li>
  );
}

export function SecretsStatus({
  initialSecrets,
  service,
  compact = false,
}: {
  initialSecrets: SecretRow[];
  service: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const secrets = initialSecrets;
  const missing = secrets.filter((s) => !s.present).length;
  const configured = secrets.length - missing;

  return (
    <div className="space-y-5">
      {!compact ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-muted-foreground max-w-2xl text-body-sm leading-relaxed">
            Paste keys here. Values go to macOS Keychain (service{" "}
            <code className="text-body-sm">{service}</code>) when available, or{" "}
            <code className="text-body-sm">.env</code> as a local fallback — never
            SQLite, backups, or exports. Existing values are never shown.
          </p>
          <p className="text-muted-foreground text-body tabular-nums">
            {configured}/{secrets.length} configured
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-body-sm">
          {configured}/{secrets.length} configured · Keychain /{" "}
          <code className="text-body-sm">.env</code>
        </p>
      )}

      {!compact && missing > 0 ? (
        <div className="bg-subtle rounded-tile px-4 py-3 text-body">
          <span className="font-medium">
            {missing} credential{missing === 1 ? "" : "s"} missing
          </span>
          <span className="text-muted-foreground">
            {" "}
            — pipeline steps that need them will fail until saved.
          </span>
        </div>
      ) : null}

      <ul className={compact ? "bg-card shadow-card divide-y divide-border rounded-card in-[.bg-card]:bg-subtle in-[.bg-card]:shadow-none px-5" : undefined}>
        {secrets.map((secret) => (
          <SecretField
            key={secret.name}
            secret={secret}
            compact={compact}
            onChanged={() => router.refresh()}
          />
        ))}
      </ul>
    </div>
  );
}
