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
}: {
  secret: SecretRow;
  onChanged: () => void;
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
    <li className="border-border space-y-4 border-b py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-[15px]">{secret.label}</p>
            {sourceBadge(secret.source)}
          </div>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {secret.purpose} · {secret.requiredFor}
          </p>
          <p className="text-muted-foreground font-mono text-[12px]">
            {secret.name}
          </p>
        </div>
        {secret.docsUrl ? (
          <a
            href={secret.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground inline-flex items-center gap-1.5 text-[13px] underline-offset-4 hover:underline"
          >
            Get key
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`secret-${secret.name}`}>
          {secret.present ? "Replace value" : "API key / value"}
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
              className="pr-11 font-mono text-[13px]"
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
          <Button type="button" disabled={!canSave} onClick={save}>
            {secret.present ? "Update" : "Save"}
          </Button>
          {secret.present ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={clear}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive text-[13px]">{error}</p>
        ) : null}
        {message ? (
          <p className="text-muted-foreground text-[13px]">{message}</p>
        ) : null}
      </div>
    </li>
  );
}

export function SecretsStatus({
  initialSecrets,
  service,
}: {
  initialSecrets: SecretRow[];
  service: string;
}) {
  const router = useRouter();
  const secrets = initialSecrets;
  const missing = secrets.filter((s) => !s.present).length;
  const configured = secrets.length - missing;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-muted-foreground max-w-2xl text-[14px] leading-relaxed">
          Paste keys here. Values go to macOS Keychain (service{" "}
          <code className="text-[12px]">{service}</code>) when available, or{" "}
          <code className="text-[12px]">.env</code> as a local fallback — never
          SQLite, backups, or exports. Existing values are never shown.
        </p>
        <p className="text-muted-foreground text-[13px] tabular-nums">
          {configured}/{secrets.length} configured
        </p>
      </div>

      {missing > 0 ? (
        <div className="border-border bg-muted/30 rounded-xl border px-4 py-3 text-[13px]">
          <span className="font-medium">
            {missing} credential{missing === 1 ? "" : "s"} missing
          </span>
          <span className="text-muted-foreground">
            {" "}
            — pipeline steps that need them will fail until saved.
          </span>
        </div>
      ) : (
        <div className="border-border rounded-xl border px-4 py-3 text-[13px]">
          All tracked credentials are present.
        </div>
      )}

      <ul>
        {secrets.map((secret) => (
          <SecretField
            key={secret.name}
            secret={secret}
            onChanged={() => router.refresh()}
          />
        ))}
      </ul>
    </div>
  );
}
