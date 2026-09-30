"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMatchingSourcesConfigAction } from "@/app/actions";
import { InlineAlert } from "@/components/inline-alert";
import {
  MATCHING_SOURCE_COPY,
  type MatchingSourcesConfig,
} from "@/modules/profile/matching-sources-core";

/** Settings that are not a connected file. Files are toggled on each source. */
const SCORING_KEYS = ["portfolioProjects", "jobPreferences"] as const satisfies ReadonlyArray<
  keyof MatchingSourcesConfig
>;

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
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <input
        type="checkbox"
        className="border-input mt-0.5 size-4 shrink-0 rounded"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-body font-medium text-foreground">
          {label}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-body-sm leading-snug">
          {helper}
        </span>
      </span>
    </label>
  );
}

export function MatchingSourcesPanel({
  config: initialConfig,
}: {
  config: MatchingSourcesConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState(initialConfig);
  const [error, setError] = useState<string | null>(null);

  const patchConfig = (key: keyof MatchingSourcesConfig, value: boolean) => {
    const prev = config;
    const next = { ...config, [key]: value };
    setConfig(next);
    setError(null);
    startTransition(async () => {
      const result = await setMatchingSourcesConfigAction({ [key]: value });
      if (!result.ok) {
        setConfig(prev);
        setError(result.error ?? "Could not update matching preference");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-1">
      <div>
        <p className="text-body font-medium">
          Also used in scoring
        </p>
        <p className="text-muted-foreground mt-0.5 text-body-sm leading-relaxed">
          Portfolio evidence and job preferences. Each file is switched on its own row.
        </p>
      </div>
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      <div className="divide-border divide-y">
        {SCORING_KEYS.map((key) => {
          const copy = MATCHING_SOURCE_COPY[key];
          return (
            <ToggleRow
              key={key}
              checked={config[key]}
              disabled={pending}
              label={copy.label}
              helper={copy.helper}
              onChange={(next) => patchConfig(key, next)}
            />
          );
        })}
      </div>
    </div>
  );
}
