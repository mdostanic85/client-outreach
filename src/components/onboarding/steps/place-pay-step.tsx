"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SurveyAnswers } from "@/modules/onboarding/survey-core";
import { Ask, Chip, OptionChips, PrimaryButton, Screen } from "@/components/onboarding/ui";

const REGION_OPTIONS = ["Europe", "United States", "United Kingdom", "Worldwide"];
const PLACE_OPTIONS = ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Anywhere in Serbia", "Abroad (EU)"];

const COMMUTE_OPTIONS: Array<{ km: number | null; label: string }> = [
  { km: 10, label: "Up to 10 km" },
  { km: 25, label: "Up to 25 km" },
  { km: 50, label: "Up to 50 km" },
  { km: null, label: "Doesn't matter" },
];

export function PlacePayStep({
  remote,
  locations,
  commuteKm,
  pay,
  availability,
  freelance,
  pending,
  onSubmit,
}: {
  remote: boolean;
  locations: string[];
  commuteKm: number | null;
  pay: SurveyAnswers["pay"];
  availability: SurveyAnswers["availability"];
  freelance: boolean;
  pending: boolean;
  onSubmit: (patch: Pick<SurveyAnswers, "locations" | "commuteKm" | "pay" | "availability">) => void;
}) {
  const base = remote ? REGION_OPTIONS : PLACE_OPTIONS;
  const [picked, setPicked] = useState<string[]>(locations);
  const [custom, setCustom] = useState("");
  const [commute, setCommute] = useState<number | null>(commuteKm);
  const options = [...base, ...picked.filter((p) => !base.includes(p))];
  const serbia = picked.some((place) => /serbia|belgrade|novi sad|ni[sš]|kragujevac/i.test(place));
  const [mode, setMode] = useState<PayMode>(pay?.mode ?? (freelance ? "hourly" : serbia ? "monthly" : "salary"));
  const [currency, setCurrency] = useState<Currency>(pay?.currency ?? (serbia ? "RSD" : "EUR"));
  const [amount, setAmount] = useState(pay?.min ? String(pay.min) : "");
  const [start, setStart] = useState(availability);
  const value = Number(amount.replace(/[^\d.]/g, ""));
  const valid = Number.isFinite(value) && value > 0;

  function toggle(location: string) {
    setPicked((prev) =>
      prev.includes(location) ? prev.filter((p) => p !== location) : [...prev, location].slice(0, 8),
    );
  }

  function addCustom(event: FormEvent) {
    event.preventDefault();
    const value = custom.trim();
    if (value && !picked.includes(value)) setPicked((prev) => [...prev, value].slice(0, 8));
    setCustom("");
  }

  /** "Anywhere in Serbia" / "Abroad (EU)" are labels; search uses plain places. */
  function forSearch(locations: string[]): string[] {
    return locations.map((l) => (l === "Anywhere in Serbia" ? "Serbia" : l === "Abroad (EU)" ? "Europe" : l));
  }

  function finish(nextPay: SurveyAnswers["pay"]) {
    if (!start || picked.length === 0) return;
    onSubmit({
      locations: forSearch(picked),
      commuteKm: remote ? null : commute,
      pay: nextPay,
      availability: start,
    });
  }

  const placeholder =
    mode === "hourly" ? "e.g. 15" : mode === "monthly" ? (currency === "RSD" ? "e.g. 120000" : "e.g. 1500") : "e.g. 40000";

  return (
    <Screen title="Where, and what pay?" hint="Pick every place that works. The number stays private.">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-9">
      <Ask title={remote ? "Which regions?" : "Which places?"} hint="Select all that apply">
      <div className="flex flex-wrap justify-center gap-3">
        {options.map((location) => (
          <Chip key={location} label={location} selected={picked.includes(location)} onClick={() => toggle(location)} />
        ))}
      </div>
      <form onSubmit={addCustom} className="mt-5 flex gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder={remote ? "Add a country or region" : "Add a city or country"}
          maxLength={60}
          className="h-12"
        />
        <Button type="submit" variant="outline" size="lg" className="h-12" disabled={!custom.trim()}>
          Add
        </Button>
      </form>
      </Ask>
      {!remote ? (
        <Ask title="How far can you commute?" hint="Pick one">
          <div className="flex flex-wrap justify-center gap-3">
            {COMMUTE_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={commute === option.km}
                onClick={() => setCommute(option.km)}
              />
            ))}
          </div>
        </Ask>
      ) : null}
      <Ask title="Minimum pay" hint={mode === "monthly" ? "Per month, after tax. Or skip the number." : "Or skip the number."}>
        <div className="flex flex-wrap justify-center gap-3">
          <Chip label="Per month" selected={mode === "monthly"} onClick={() => setMode("monthly")} />
          <Chip label="Per year" selected={mode === "salary"} onClick={() => setMode("salary")} />
          <Chip label="Per hour" selected={mode === "hourly"} onClick={() => setMode("hourly")} />
        </div>
        <div className="mt-4 flex gap-3">
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            aria-label="Currency"
            className="border-input bg-card h-14 rounded-full border px-4 text-body"
          >
            {(["EUR", "USD", "GBP", "CHF", "RSD"] as const).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={placeholder}
            className="h-14 rounded-2xl text-center text-h5"
          />
        </div>
      </Ask>
      <Ask title="When could you start?" hint="Pick one">
        <OptionChips
          value={start}
          disabled={pending}
          onPick={setStart}
          options={[
            { id: "now", label: "Right away" },
            { id: "soon", label: "In 1–2 months" },
            { id: "exploring", label: "Just looking for now" },
          ]}
        />
      </Ask>
      <div className="flex flex-col items-center gap-3">
        <PrimaryButton
          disabled={picked.length === 0 || !start || (amount.trim().length > 0 && !valid)}
          pending={pending}
          onClick={() => finish(valid ? { mode, currency, min: value } : null)}
        >
          Continue
        </PrimaryButton>
        <button
          type="button"
          onClick={() => finish(null)}
          disabled={pending || !start || picked.length === 0}
          className="text-muted-foreground hover:text-foreground h-12 px-3 text-body font-medium transition-colors"
        >
          Skip the pay
        </button>
      </div>
      </div>
    </Screen>
  );
}

type PayMode = "salary" | "monthly" | "hourly";
type Currency = "EUR" | "USD" | "GBP" | "CHF" | "RSD";
