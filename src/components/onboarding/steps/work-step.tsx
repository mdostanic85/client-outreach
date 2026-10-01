"use client";

import { useState } from "react";
import { ENGAGEMENTS, ENGAGEMENT_LABELS, EXPERIENCE, EXPERIENCE_LABELS, type SurveyAnswers } from "@/modules/onboarding/survey-core";
import { Ask, Chip, OptionChips, PrimaryButton, Screen } from "@/components/onboarding/ui";

export function WorkStep({
  experience,
  level,
  usesLevels,
  engagement,
  workMode,
  remote,
  pending,
  onSubmit,
}: {
  experience: SurveyAnswers["experience"];
  level: SurveyAnswers["level"];
  usesLevels: boolean;
  engagement: Array<(typeof ENGAGEMENTS)[number]>;
  workMode: SurveyAnswers["workMode"];
  remote: boolean;
  pending: boolean;
  onSubmit: (patch: Pick<SurveyAnswers, "experience" | "level" | "engagement" | "workMode">) => void;
}) {
  const [years, setYears] = useState(experience);
  const [aim, setAim] = useState(level);
  const [picked, setPicked] = useState(engagement);
  const [place, setPlace] = useState(workMode);

  function toggle(id: (typeof ENGAGEMENTS)[number]) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const places = remote
    ? ([
        { id: "onsite" as const, label: "On-site" },
        { id: "hybrid" as const, label: "Hybrid" },
        { id: "remote" as const, label: "Remote" },
        { id: "any" as const, label: "Any of these" },
      ] as const)
    : ([
        { id: "onsite" as const, label: "On-site" },
        { id: "any" as const, label: "Doesn't matter" },
      ] as const);

  return (
    <Screen title="What kind of work?" hint="A few answers so the list stays relevant.">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-9">
        <Ask title="How long have you done this?" hint="Pick one">
          <OptionChips
            value={years}
            disabled={pending}
            onPick={setYears}
            options={EXPERIENCE.map((id) => ({ id, label: EXPERIENCE_LABELS[id] }))}
          />
        </Ask>
        {usesLevels ? (
          <Ask title="What level are you aiming for?" hint="Pick one">
            <OptionChips
              value={aim}
              disabled={pending}
              onPick={setAim}
              options={[
                { id: "junior", label: "Junior" },
                { id: "mid", label: "Mid-level" },
                { id: "senior", label: "Senior" },
                { id: "lead", label: "Lead" },
                { id: "head", label: "Head or Director" },
              ]}
            />
          </Ask>
        ) : null}
        <Ask title="What are you open to?" hint="Select all that apply">
          <div className="flex flex-wrap justify-center gap-3">
            {ENGAGEMENTS.map((id) => (
              <Chip
                key={id}
                label={ENGAGEMENT_LABELS[id]}
                selected={picked.includes(id)}
                disabled={pending}
                onClick={() => toggle(id)}
              />
            ))}
          </div>
        </Ask>
        <Ask title="Where do you want to work?" hint="Pick one">
          <OptionChips value={place} disabled={pending} onPick={setPlace} options={[...places]} />
        </Ask>
        <PrimaryButton
          disabled={!years || (usesLevels && !aim) || picked.length === 0 || !place}
          pending={pending}
          onClick={() => place && onSubmit({ experience: years, level: aim, engagement: picked, workMode: place })}
        >
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}
