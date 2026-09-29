"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/app/actions";
import { InlineAlert } from "@/components/inline-alert";
import { PanelBody, PanelHeader, Surface } from "@/components/page-shell";
import { StickyFormActions } from "@/components/sticky-form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SEND_POLICY } from "@/modules/mail/policy-defaults";

type StyleProfile = {
  voiceNotes?: string;
  doList?: string[];
  dontList?: string[];
  preferredLength?: string;
  ctaPatterns?: string[];
  proofPoints?: string[];
  languageNotes?: Record<string, string>;
  examples?: string[];
};

type FormInitial = {
  profileMd: string;
  styleProfileJson: string;
  targetFiltersJson: string;
  countryPolicyJson: string;
  sendPolicyJson: string;
  dailyLeadCount: number;
  aiBudgetUsd: number;
};

function parseSendPolicy(json: string) {
  try {
    const stored = JSON.parse(json || "{}") as Partial<typeof DEFAULT_SEND_POLICY>;
    return {
      maxNewPerDay: stored.maxNewPerDay ?? DEFAULT_SEND_POLICY.maxNewPerDay,
      weekdaysOnly: stored.weekdaysOnly ?? DEFAULT_SEND_POLICY.weekdaysOnly,
      maxFollowUps: stored.maxFollowUps ?? DEFAULT_SEND_POLICY.maxFollowUps,
      followUpOffsetsDays:
        stored.followUpOffsetsDays ?? DEFAULT_SEND_POLICY.followUpOffsetsDays,
    };
  } catch {
    return { ...DEFAULT_SEND_POLICY };
  }
}

function buildStyleProfile(styleJson: string): StyleProfile {
  try {
    return JSON.parse(styleJson || "{}") as StyleProfile;
  } catch {
    return {};
  }
}

function buildSnapshot(values: {
  profileMd: string;
  voiceNotes: string;
  doList: string;
  dontList: string;
  preferredLength: string;
  ctaPatterns: string;
  proofPoints: string;
  examples: string;
  filtersJson: string;
  policyJson: string;
  maxNewPerDay: string;
  weekdaysOnly: boolean;
  maxFollowUps: string;
  dailyLeadCount: string;
  aiBudgetUsd: string;
  languageNotes: Record<string, string>;
}) {
  return JSON.stringify({
    profileMd: values.profileMd,
    voiceNotes: values.voiceNotes,
    doList: values.doList,
    dontList: values.dontList,
    preferredLength: values.preferredLength,
    ctaPatterns: values.ctaPatterns,
    proofPoints: values.proofPoints,
    examples: values.examples,
    filtersJson: values.filtersJson,
    policyJson: values.policyJson,
    maxNewPerDay: values.maxNewPerDay,
    weekdaysOnly: values.weekdaysOnly,
    maxFollowUps: values.maxFollowUps,
    dailyLeadCount: values.dailyLeadCount,
    aiBudgetUsd: values.aiBudgetUsd,
    languageNotes: values.languageNotes,
  });
}

export function SettingsForm({ initial }: { initial: FormInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const style = buildStyleProfile(initial.styleProfileJson);
  const initialSendPolicy = parseSendPolicy(initial.sendPolicyJson);

  const [profileMd, setProfileMd] = useState(initial.profileMd);
  const [voiceNotes, setVoiceNotes] = useState(style.voiceNotes ?? "");
  const [doList, setDoList] = useState((style.doList ?? []).join("\n"));
  const [dontList, setDontList] = useState((style.dontList ?? []).join("\n"));
  const [preferredLength, setPreferredLength] = useState(
    style.preferredLength ?? "70-120 words",
  );
  const [ctaPatterns, setCtaPatterns] = useState(
    (style.ctaPatterns ?? []).join("\n"),
  );
  const [proofPoints, setProofPoints] = useState(
    (style.proofPoints ?? []).join("\n"),
  );
  const [examples, setExamples] = useState((style.examples ?? []).join("\n---\n"));
  const [filtersJson, setFiltersJson] = useState(initial.targetFiltersJson);
  const [policyJson, setPolicyJson] = useState(initial.countryPolicyJson);
  const [maxNewPerDay, setMaxNewPerDay] = useState(
    String(initialSendPolicy.maxNewPerDay),
  );
  const [weekdaysOnly, setWeekdaysOnly] = useState(initialSendPolicy.weekdaysOnly);
  const [maxFollowUps, setMaxFollowUps] = useState(
    String(initialSendPolicy.maxFollowUps),
  );
  const [followUpOffsetsDays] = useState(initialSendPolicy.followUpOffsetsDays);
  const [dailyLeadCount, setDailyLeadCount] = useState(String(initial.dailyLeadCount));
  const [aiBudgetUsd, setAiBudgetUsd] = useState(String(initial.aiBudgetUsd));

  const [languageNotes] = useState(() => style.languageNotes ?? {});

  const currentSnapshot = useMemo(
    () =>
      buildSnapshot({
        profileMd,
        voiceNotes,
        doList,
        dontList,
        preferredLength,
        ctaPatterns,
        proofPoints,
        examples,
        filtersJson,
        policyJson,
        maxNewPerDay,
        weekdaysOnly,
        maxFollowUps,
        dailyLeadCount,
        aiBudgetUsd,
        languageNotes,
      }),
    [
      profileMd,
      voiceNotes,
      doList,
      dontList,
      preferredLength,
      ctaPatterns,
      proofPoints,
      examples,
      filtersJson,
      policyJson,
      maxNewPerDay,
      weekdaysOnly,
      maxFollowUps,
      dailyLeadCount,
      aiBudgetUsd,
      languageNotes,
    ],
  );

  const [baseline, setBaseline] = useState(() =>
    buildSnapshot({
      profileMd: initial.profileMd,
      voiceNotes: style.voiceNotes ?? "",
      doList: (style.doList ?? []).join("\n"),
      dontList: (style.dontList ?? []).join("\n"),
      preferredLength: style.preferredLength ?? "70-120 words",
      ctaPatterns: (style.ctaPatterns ?? []).join("\n"),
      proofPoints: (style.proofPoints ?? []).join("\n"),
      examples: (style.examples ?? []).join("\n---\n"),
      filtersJson: initial.targetFiltersJson,
      policyJson: initial.countryPolicyJson,
      maxNewPerDay: String(initialSendPolicy.maxNewPerDay),
      weekdaysOnly: initialSendPolicy.weekdaysOnly,
      maxFollowUps: String(initialSendPolicy.maxFollowUps),
      dailyLeadCount: String(initial.dailyLeadCount),
      aiBudgetUsd: String(initial.aiBudgetUsd),
      languageNotes: style.languageNotes ?? {},
    }),
  );

  const isDirty = currentSnapshot !== baseline;

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const styleProfile = {
        voiceNotes,
        doList: doList
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        dontList: dontList
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        preferredLength,
        ctaPatterns: ctaPatterns
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        proofPoints: proofPoints
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        languageNotes,
        examples: examples
          .split(/\n---\n/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 5),
      };

      const sendPolicyJson = JSON.stringify({
        maxNewPerDay: Number(maxNewPerDay) || DEFAULT_SEND_POLICY.maxNewPerDay,
        weekdaysOnly,
        maxFollowUps: Number(maxFollowUps) || DEFAULT_SEND_POLICY.maxFollowUps,
        followUpOffsetsDays,
      });

      const result = await updateSettingsAction({
        profileMd,
        styleProfileJson: JSON.stringify(styleProfile),
        targetFiltersJson: filtersJson,
        countryPolicyJson: policyJson,
        sendPolicyJson,
        dailyLeadCount: Number(dailyLeadCount) || 12,
        aiBudgetUsd: Number(aiBudgetUsd) || 8,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBaseline(currentSnapshot);
      setSaved(true);
      toast.success("Settings saved");
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      {error ? (
        <InlineAlert variant="error">{error}</InlineAlert>
      ) : null}
      {saved ? (
        <InlineAlert variant="success">Settings saved.</InlineAlert>
      ) : null}

      <Surface>
        <PanelHeader className="flex-col items-start gap-1">
          <p className="font-display text-[16px] font-semibold tracking-tight">
            How you introduce yourself
          </p>
        </PanelHeader>
        <PanelBody className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile">About you (for emails)</Label>
            <p className="text-muted-foreground text-[14px] leading-snug">
              Short positioning used in cold emails. This is not your
              job-matching Profile.
            </p>
            <Textarea
              id="profile"
              className="min-h-28"
              value={profileMd}
              onChange={(e) => setProfileMd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proof">Proof points (one per line)</Label>
            <Textarea
              id="proof"
              value={proofPoints}
              onChange={(e) => setProofPoints(e.target.value)}
            />
          </div>
        </PanelBody>
      </Surface>

      <Surface>
        <PanelHeader className="flex-col items-start gap-1">
          <p className="font-display text-[16px] font-semibold tracking-tight">
            Email writing style
          </p>
          <p className="text-muted-foreground text-[15px]">
            Tone notes, do/don&apos;t lists, and example emails.
          </p>
        </PanelHeader>
        <PanelBody className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="voice">Tone notes</Label>
            <Textarea
              id="voice"
              value={voiceNotes}
              onChange={(e) => setVoiceNotes(e.target.value)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="do">Do phrases</Label>
              <Textarea
                id="do"
                value={doList}
                onChange={(e) => setDoList(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dont">Don&apos;t phrases</Label>
              <Textarea
                id="dont"
                value={dontList}
                onChange={(e) => setDontList(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="len">Preferred length</Label>
            <Input
              id="len"
              value={preferredLength}
              onChange={(e) => setPreferredLength(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cta">CTA patterns (one per line)</Label>
            <Textarea
              id="cta"
              value={ctaPatterns}
              onChange={(e) => setCtaPatterns(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="examples">Examples (3–5)</Label>
            <p className="text-muted-foreground text-[14px] leading-snug">
              Paste 3–5 emails you like. Separate with a line that only contains
              ---.
            </p>
            <Textarea
              id="examples"
              className="min-h-40 font-mono text-[15px]"
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              placeholder={"Example email 1\n---\nExample email 2"}
            />
          </div>
        </PanelBody>
      </Surface>

      <Surface>
        <PanelHeader className="flex-col items-start gap-1">
          <p className="font-display text-[16px] font-semibold tracking-tight">
            Send volume
          </p>
          <p className="text-muted-foreground text-[15px]">
            Daily company review limits, AI budget, and outreach send caps.
          </p>
        </PanelHeader>
        <PanelBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="daily">Companies to review per day</Label>
              <Input
                id="daily"
                type="number"
                value={dailyLeadCount}
                onChange={(e) => setDailyLeadCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">AI spend limit (USD)</Label>
              <Input
                id="budget"
                type="number"
                step="0.5"
                value={aiBudgetUsd}
                onChange={(e) => setAiBudgetUsd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxNewPerDay">Max new emails per day</Label>
              <Input
                id="maxNewPerDay"
                type="number"
                min={1}
                value={maxNewPerDay}
                onChange={(e) => setMaxNewPerDay(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxFollowUps">Max follow-ups</Label>
              <Input
                id="maxFollowUps"
                type="number"
                min={0}
                value={maxFollowUps}
                onChange={(e) => setMaxFollowUps(e.target.value)}
              />
            </div>
          </div>
          <label className="text-muted-foreground flex cursor-pointer items-start gap-2.5 text-[14px] leading-snug">
            <input
              id="weekdaysOnly"
              type="checkbox"
              className="border-input bg-background text-foreground mt-0.5 size-4 shrink-0 rounded"
              checked={weekdaysOnly}
              onChange={(e) => setWeekdaysOnly(e.target.checked)}
            />
            Send on weekdays only
          </label>
        </PanelBody>
      </Surface>

      <Surface>
        <details className="group">
          <summary className="border-border flex cursor-pointer list-none items-center justify-between gap-3 border-b px-5 py-5 font-medium sm:px-8 sm:py-6 select-none [&::-webkit-details-marker]:hidden">
            <div className="space-y-1">
              <p className="font-display text-[16px] font-semibold tracking-tight">
                Advanced
              </p>
              <p className="text-muted-foreground text-[15px] font-normal">
                Raw filter and country-policy JSON — leave alone unless you need
                custom rules.
              </p>
            </div>
            <span className="text-muted-foreground text-[14px] group-open:hidden">
              Show
            </span>
            <span className="text-muted-foreground hidden text-[14px] group-open:inline">
              Hide
            </span>
          </summary>
          <PanelBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="filters">Target filters JSON</Label>
              <Textarea
                id="filters"
                className="min-h-28 font-mono text-[15px]"
                value={filtersJson}
                onChange={(e) => setFiltersJson(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy">Country policy JSON</Label>
              <Textarea
                id="policy"
                className="min-h-24 font-mono text-[15px]"
                value={policyJson}
                onChange={(e) => setPolicyJson(e.target.value)}
              />
              <p className="text-muted-foreground text-[14px]">
                Values: draft_allowed · manual_review_required ·
                prior_interaction_required · blocked · unknown
              </p>
            </div>
          </PanelBody>
        </details>
      </Surface>

      <StickyFormActions
        message={isDirty ? "You have unsaved changes." : undefined}
      >
        <Button
          size="lg"
          disabled={pending || !isDirty}
          onClick={save}
        >
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </StickyFormActions>
    </div>
  );
}
