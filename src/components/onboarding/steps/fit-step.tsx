"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANGUAGE_LEVELS, PRIORITIES, PRIORITY_LABELS, remoteOffered, type SurveyAnswers } from "@/modules/onboarding/survey-core";
import type { OccupationFamily } from "@/modules/occupations/families";
import { Ask, Chip, PrimaryButton, Screen, TagInput, Toggle } from "@/components/onboarding/ui";

type Details = Pick<
  SurveyAnswers,
  | "licenses"
  | "tachographCard"
  | "internationalRoutes"
  | "professionalLicense"
  | "shifts"
  | "nights"
  | "weekends"
  | "sanitaryBook"
  | "ownTools"
  | "certifications"
  | "stack"
>;

const LICENCE_CATEGORIES = ["B", "C", "CE", "D", "C1", "ADR"];


/** The questions that only matter for this family of jobs. */
export function FitStep({
  family,
  survey,
  pending,
  onSubmit,
}: {
  family: OccupationFamily;
  survey: SurveyAnswers;
  pending: boolean;
  onSubmit: (patch: Details & Pick<SurveyAnswers, "languages" | "priorities">) => void;
}) {
  const [d, setD] = useState<Details>({
    licenses: survey.licenses ?? [],
    tachographCard: survey.tachographCard,
    internationalRoutes: survey.internationalRoutes,
    professionalLicense: survey.professionalLicense,
    shifts: survey.shifts,
    nights: survey.nights,
    weekends: survey.weekends,
    sanitaryBook: survey.sanitaryBook,
    ownTools: survey.ownTools,
    certifications: survey.certifications ?? [],
    stack: survey.stack ?? [],
  });
  const set = (patch: Details) => setD((prev) => ({ ...prev, ...patch }));
  const licences = d.licenses ?? [];
  const [rows, setRows] = useState<LanguageAnswer[]>(survey.languages ?? []);
  const [priorities, setPriorities] = useState<Priority[]>(survey.priorities ?? []);
  const [languageDraft, setLanguageDraft] = useState("");
  const priorityFull = priorities.length >= 3;
  const hasLanguage = (name: string) => rows.some((row) => row.language.toLowerCase() === name.toLowerCase());

  function addLanguage(language: string) {
    const name = language.trim();
    if (!name || hasLanguage(name)) return;
    setRows((prev) => [...prev, { language: name, level: "conversational" as const }].slice(0, 8));
  }

  function togglePriority(id: Priority) {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : priorityFull ? prev : [...prev, id],
    );
  }

  const schedule = (
    <div>
      <p className="mb-1 text-body font-medium">I can work</p>
      <p className="text-muted-foreground mb-3 text-body-sm">Select all that apply</p>
      <div className="flex flex-wrap gap-2">
        <Toggle label="Shifts" value={d.shifts} onChange={(shifts) => set({ shifts })} />
        <Toggle label="Nights" value={d.nights} onChange={(nights) => set({ nights })} />
        <Toggle label="Weekends" value={d.weekends} onChange={(weekends) => set({ weekends })} />
      </div>
    </div>
  );

  /** Unselected schedule chips mean "no" once the question was shown. */
  function submit() {
    const asksSchedule = family === "healthcare" || family === "hospitality_retail" || family === "transport_logistics";
    onSubmit({
      ...d,
      ...(asksSchedule ? { shifts: Boolean(d.shifts), nights: Boolean(d.nights), weekends: Boolean(d.weekends) } : {}),
      languages: rows,
      priorities,
    });
  }

  const content: Record<OccupationFamily, { title: string; body: ReactNode }> = {
    transport_logistics: {
      title: "Licences and routes",
      body: (
        <>
          <div>
            <p className="mb-1 text-body font-medium">Driving licence categories</p>
            <p className="text-muted-foreground mb-3 text-body-sm">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {LICENCE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  selected={licences.includes(cat)}
                  onClick={() =>
                    set({ licenses: licences.includes(cat) ? licences.filter((l) => l !== cat) : [...licences, cat] })
                  }
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a tachograph card" value={d.tachographCard} onChange={(tachographCard) => set({ tachographCard })} />
            <Toggle label="International routes are fine" value={d.internationalRoutes} onChange={(internationalRoutes) => set({ internationalRoutes })} />
          </div>
          {schedule}
        </>
      ),
    },
    healthcare: {
      title: "Licence and schedule",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a valid licence to work" value={d.professionalLicense} onChange={(professionalLicense) => set({ professionalLicense })} />
          </div>
          {schedule}
          <TagInput label="Certificates (optional)" placeholder="e.g. BLS, ICU course" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
        </>
      ),
    },
    hospitality_retail: {
      title: "Schedule and papers",
      body: (
        <>
          {schedule}
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a sanitary booklet" value={d.sanitaryBook} onChange={(sanitaryBook) => set({ sanitaryBook })} />
          </div>
        </>
      ),
    },
    trades: {
      title: "Certificates and tools",
      body: (
        <>
          <TagInput label="Certificates" placeholder="e.g. EN ISO 9606-1, electrical licence" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have my own tools" value={d.ownTools} onChange={(ownTools) => set({ ownTools })} />
          </div>
        </>
      ),
    },
    tech_digital: {
      title: "Your stack",
      body: (
        <TagInput label="Languages, frameworks and tools you use most" placeholder="e.g. React, Python, Figma" values={d.stack ?? []} onChange={(stack) => set({ stack })} />
      ),
    },
    office_business: {
      title: "Software and certificates",
      body: (
        <>
          <TagInput label="Software you use" placeholder="e.g. Excel, SAP, Salesforce" values={d.stack ?? []} onChange={(stack) => set({ stack })} />
          <TagInput label="Certificates (optional)" placeholder="e.g. ACCA, PMP" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
        </>
      ),
    },
    education: {
      title: "Licence and certificates",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            <Toggle label="I have a teaching licence" value={d.professionalLicense} onChange={(professionalLicense) => set({ professionalLicense })} />
          </div>
          <TagInput label="Certificates (optional)" placeholder="e.g. CELTA, Montessori" values={d.certifications ?? []} onChange={(certifications) => set({ certifications })} />
        </>
      ),
    },
  };

  return (
    <Screen title={content[family].title} hint="Only what this kind of job usually needs. Languages and priorities are optional.">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        {content[family].body}
        <Ask title="Languages you can work in" hint="Select all that apply. Set a level after you add one.">
          <div className="flex flex-wrap justify-center gap-3">
            {LANGUAGE_SUGGESTIONS.filter((language) => !hasLanguage(language)).map((language) => (
              <Chip key={language} label={language} selected={false} onClick={() => addLanguage(language)} />
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addLanguage(languageDraft);
              setLanguageDraft("");
            }}
            className="mt-4 flex gap-2"
          >
            <Input
              value={languageDraft}
              onChange={(event) => setLanguageDraft(event.target.value)}
              placeholder="Another language"
              maxLength={40}
              className="h-12"
            />
            <Button type="submit" variant="outline" size="lg" className="h-12" disabled={!languageDraft.trim()}>
              Add
            </Button>
          </form>
          {rows.length ? (
            <ul className="bg-card mt-4 divide-y divide-border rounded-card shadow-card">
              {rows.map((row) => (
                <li key={row.language} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-body font-medium">{row.language}</span>
                  <span className="flex items-center gap-2">
                    <select
                      value={row.level}
                      aria-label={`${row.language} level`}
                      onChange={(event) =>
                        setRows((prev) =>
                          prev.map((item) =>
                            item.language === row.language
                              ? { ...item, level: event.target.value as LanguageAnswer["level"] }
                              : item,
                          ),
                        )
                      }
                      className="border-input bg-card h-10 rounded-full border px-3 text-body"
                    >
                      {LANGUAGE_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {LANGUAGE_LEVEL_LABELS[level]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove ${row.language}`}
                      onClick={() => setRows((prev) => prev.filter((item) => item.language !== row.language))}
                      className="text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-full"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Ask>
        <Ask title="What matters most?" hint="Pick up to 3">
          <div className="flex flex-wrap justify-center gap-3">
            {prioritiesFor(family).map((id) => (
              <Chip
                key={id}
                label={PRIORITY_LABELS[id]}
                selected={priorities.includes(id)}
                disabled={priorityFull && !priorities.includes(id)}
                onClick={() => togglePriority(id)}
              />
            ))}
          </div>
        </Ask>
        <PrimaryButton pending={pending} onClick={submit}>
          Continue
        </PrimaryButton>
      </div>
    </Screen>
  );
}

type LanguageAnswer = NonNullable<SurveyAnswers["languages"]>[number];
type Priority = (typeof PRIORITIES)[number];

const LANGUAGE_SUGGESTIONS = ["Serbian", "English", "German", "Russian", "Hungarian", "French", "Italian"];
const LANGUAGE_LEVEL_LABELS: Record<(typeof LANGUAGE_LEVELS)[number], string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native",
};


/** "Great product" is a tech concern; commute and schedule matter on-site. */
function prioritiesFor(family: OccupationFamily | undefined): Priority[] {
  const remote = remoteOffered(family);
  return PRIORITIES.filter((p) => {
    if (p === "product") return family === "tech_digital";
    if (p === "close_to_home" || p === "fixed_schedule") return !remote;
    return true;
  });
}
