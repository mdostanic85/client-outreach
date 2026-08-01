"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="space-y-8">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {saved ? (
        <p className="text-muted-foreground text-sm">Saved.</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How you introduce yourself</CardTitle>
          <CardDescription>
            Used in outreach emails. Separate from your job-matching Profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="profile">About you (for emails)</Label>
            <Textarea
              id="profile"
              className="min-h-28"
              value={profileMd}
              onChange={(e) => setProfileMd(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="proof">Proof points (one per line)</Label>
            <Textarea
              id="proof"
              value={proofPoints}
              onChange={(e) => setProofPoints(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email writing style</CardTitle>
          <CardDescription>
            Short tone notes plus do/don&apos;t lists. Add 3–5 email examples
            separated by a line with only ---.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="voice">Tone notes</Label>
            <Textarea
              id="voice"
              value={voiceNotes}
              onChange={(e) => setVoiceNotes(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="do">Do phrases (one per line)</Label>
            <Textarea id="do" value={doList} onChange={(e) => setDoList(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dont">Don&apos;t phrases (one per line)</Label>
            <Textarea
              id="dont"
              value={dontList}
              onChange={(e) => setDontList(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="len">Preferred length</Label>
            <Input
              id="len"
              value={preferredLength}
              onChange={(e) => setPreferredLength(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cta">CTA patterns (one per line)</Label>
            <Textarea
              id="cta"
              value={ctaPatterns}
              onChange={(e) => setCtaPatterns(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="examples">Examples (3–5)</Label>
            <Textarea
              id="examples"
              className="min-h-40 font-mono text-xs"
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              placeholder={"Example email 1\n---\nExample email 2"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters & policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="daily">Companies to review per day</Label>
              <Input
                id="daily"
                type="number"
                value={dailyLeadCount}
                onChange={(e) => setDailyLeadCount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
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
          <div className="grid gap-2">
            <Label htmlFor="filters">Target filters JSON</Label>
            <Textarea
              id="filters"
              className="min-h-28 font-mono text-xs"
              value={filtersJson}
              onChange={(e) => setFiltersJson(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="policy">Country policy JSON</Label>
            <Textarea
              id="policy"
              className="min-h-24 font-mono text-xs"
              value={policyJson}
              onChange={(e) => setPolicyJson(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Values: draft_allowed | manual_review_required |
              prior_interaction_required | blocked | unknown
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sendPolicy">Send policy JSON</Label>
            <Textarea
              id="sendPolicy"
              className="min-h-24 font-mono text-xs"
              value={sendPolicyJson}
              onChange={(e) => setSendPolicyJson(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Default: max 5/day, weekdays only, two follow-ups. Cap raise to 10
              only after ≥50 valid deliveries.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button disabled={pending} onClick={save}>
        Save settings
      </Button>
    </div>
  );
}
