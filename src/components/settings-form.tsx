"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions";
import { PanelBody, PanelHeader, Surface } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export function SettingsForm({
  initial,
}: {
  initial: {
    profileMd: string;
    styleProfileJson: string;
    targetFiltersJson: string;
    countryPolicyJson: string;
    sendPolicyJson: string;
    dailyLeadCount: number;
    aiBudgetUsd: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const style = JSON.parse(initial.styleProfileJson || "{}") as StyleProfile;

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
  const [sendPolicyJson, setSendPolicyJson] = useState(
    initial.sendPolicyJson && initial.sendPolicyJson !== "{}"
      ? initial.sendPolicyJson
      : JSON.stringify(
          {
            maxNewPerDay: 5,
            weekdaysOnly: true,
            maxFollowUps: 2,
            followUpOffsetsDays: [5, 12],
          },
          null,
          2,
        ),
  );
  const [dailyLeadCount, setDailyLeadCount] = useState(String(initial.dailyLeadCount));
  const [aiBudgetUsd, setAiBudgetUsd] = useState(String(initial.aiBudgetUsd));

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const styleProfile = {
        voiceNotes,
        doList: doList.split("\n").map((s) => s.trim()).filter(Boolean),
        dontList: dontList.split("\n").map((s) => s.trim()).filter(Boolean),
        preferredLength,
        ctaPatterns: ctaPatterns.split("\n").map((s) => s.trim()).filter(Boolean),
        proofPoints: proofPoints.split("\n").map((s) => s.trim()).filter(Boolean),
        languageNotes: style.languageNotes ?? {},
        examples: examples
          .split(/\n---\n/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 5),
      };

      const result = await updateSettingsAction({
        profileMd,
        styleProfileJson: JSON.stringify(styleProfile),
        targetFiltersJson: filtersJson,
        countryPolicyJson: policyJson,
        sendPolicyJson,
        dailyLeadCount: Number(dailyLeadCount) || 12,
        aiBudgetUsd: Number(aiBudgetUsd) || 8,
      });

      if (!result.ok) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-5">
      {error ? (
        <p className="text-destructive text-[14px]">{error}</p>
      ) : null}
      {saved ? (
        <p className="text-muted-foreground text-[14px]">Saved.</p>
      ) : null}

      <Surface>
        <PanelHeader className="flex-col items-start gap-1">
          <p className="font-display text-[16px] font-semibold tracking-tight">
            How you introduce yourself
          </p>
          <p className="text-muted-foreground text-[13px]">
            Used in outreach emails — separate from your job-matching Profile.
          </p>
        </PanelHeader>
        <PanelBody className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile">About you (for emails)</Label>
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
          <p className="text-muted-foreground text-[13px]">
            Tone notes, do/don’t lists, and 3–5 examples separated by ---.
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
            <Textarea
              id="examples"
              className="min-h-40 font-mono text-[13px]"
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
            Filters & policy
          </p>
          <p className="text-muted-foreground text-[13px]">
            Daily volume, AI budget, and send limits.
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
          <div className="space-y-2">
            <Label htmlFor="filters">Target filters JSON</Label>
            <Textarea
              id="filters"
              className="min-h-28 font-mono text-[13px]"
              value={filtersJson}
              onChange={(e) => setFiltersJson(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy">Country policy JSON</Label>
            <Textarea
              id="policy"
              className="min-h-24 font-mono text-[13px]"
              value={policyJson}
              onChange={(e) => setPolicyJson(e.target.value)}
            />
            <p className="text-muted-foreground text-[12px]">
              Values: draft_allowed · manual_review_required ·
              prior_interaction_required · blocked · unknown
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sendPolicy">Send policy JSON</Label>
            <Textarea
              id="sendPolicy"
              className="min-h-24 font-mono text-[13px]"
              value={sendPolicyJson}
              onChange={(e) => setSendPolicyJson(e.target.value)}
            />
            <p className="text-muted-foreground text-[12px]">
              Default: max 5/day, weekdays, two follow-ups.
            </p>
          </div>
        </PanelBody>
      </Surface>

      <div className="flex items-center gap-3">
        <Button size="lg" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {saved ? (
          <span className="text-muted-foreground text-[13px]">All changes saved</span>
        ) : null}
      </div>
    </div>
  );
}
