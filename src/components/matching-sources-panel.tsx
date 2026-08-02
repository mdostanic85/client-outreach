"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  setMatchingSourcesConfigAction,
  setProfileSourceMatchingEnabledAction,
  setUsePortfolioInMatchingAction,
} from "@/app/actions";
import { InlineAlert } from "@/components/inline-alert";
import { PanelBody, PanelHeader, Surface } from "@/components/page-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MATCHING_SOURCE_COPY,
  type MatchingSourcesConfig,
} from "@/modules/profile/matching-sources-core";
import { cn } from "@/lib/utils";

type SourceRow = {
  id: string;
  type: string;
  label: string | null;
  enabledForMatching: boolean;
  lastSyncedAt: string | null;
};

const CATEGORY_KEYS: Array<keyof MatchingSourcesConfig> = [
  "portfolioProjects",
  "linkedin",
  "cv",
  "manual",
  "github",
  "jobPreferences",
  "activitySignals",
];

function ToggleRow({
  checked,
  disabled,
  label,
  helper,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  helper: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2"
      title={`${helper} This never deletes stored data.`}
    >
      <input
        type="checkbox"
        className="border-input bg-background text-foreground mt-0.5 size-4 shrink-0 rounded"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="block cursor-help text-[15px] font-medium text-[var(--card-foreground)]" />
            }
          >
            {label}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-left leading-relaxed">
            {helper} Turning this off never deletes stored data.
          </TooltipContent>
        </Tooltip>
        <span className="text-muted-foreground mt-0.5 block text-[13px] leading-snug">
          {helper}
        </span>
      </span>
    </label>
  );
}

export function MatchingSourcesPanel({
  config: initialConfig,
  sources,
}: {
  config: MatchingSourcesConfig;
  sources: SourceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState(initialConfig);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const patchConfig = (key: keyof MatchingSourcesConfig, value: boolean) => {
    const prev = config;
    const next = { ...config, [key]: value };
    setConfig(next);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result =
        key === "portfolioProjects"
          ? await setUsePortfolioInMatchingAction(value)
          : await setMatchingSourcesConfigAction({ [key]: value });
      if (!result.ok) {
        setConfig(prev);
        setError(result.error ?? "Could not update matching preference");
        return;
      }
      setMessage(
        value
          ? "Matching preference updated — data kept."
          : "Excluded from match scores — your data is still saved.",
      );
      router.refresh();
    });
  };

  const toggleSource = (id: string, enabled: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setProfileSourceMatchingEnabledAction(id, enabled);
      if (!result.ok) {
        setError(result.error ?? "Could not update source");
        return;
      }
      setMessage(
        enabled
          ? "Source enabled for matching."
          : "Source disabled for matching — data kept.",
      );
      router.refresh();
    });
  };

  return (
    <Surface>
      <PanelHeader className="flex-col items-start gap-1">
        <p className="font-display text-[16px] font-semibold tracking-tight">
          Matching Sources
        </p>
        <p className="text-muted-foreground text-[14px] leading-relaxed">
          Control what feeds job match scores. Turning something off never
          deletes your Professional Profile or connected sources.
        </p>
      </PanelHeader>
      <PanelBody className="space-y-6">
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        {message ? <InlineAlert variant="success">{message}</InlineAlert> : null}

        <div className="divide-border divide-y">
          {CATEGORY_KEYS.map((key) => {
            const copy = MATCHING_SOURCE_COPY[key];
            return (
              <ToggleRow
                key={key}
                checked={config[key]}
                disabled={pending || key === "activitySignals"}
                label={copy.label}
                helper={
                  key === "activitySignals"
                    ? `${copy.helper} (uses triage history when available.)`
                    : copy.helper
                }
                onChange={(next) => patchConfig(key, next)}
              />
            );
          })}
        </div>

        {sources.length > 0 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
              Connected sources
            </p>
            <ul className="space-y-2">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    "border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">
                      {s.label ?? s.type}
                    </p>
                    <p className="text-muted-foreground text-[13px]">
                      {s.lastSyncedAt
                        ? `Last synced ${new Date(s.lastSyncedAt).toLocaleString()}`
                        : "Not synced yet"}
                    </p>
                  </div>
                  <label className="text-muted-foreground flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="border-input size-4 rounded"
                      checked={s.enabledForMatching}
                      disabled={pending}
                      onChange={(e) => toggleSource(s.id, e.target.checked)}
                    />
                    Use for matching
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PanelBody>
    </Surface>
  );
}
