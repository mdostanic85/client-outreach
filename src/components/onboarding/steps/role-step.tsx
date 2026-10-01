"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import type { Occupation } from "@/modules/occupations/catalog";
import { FAMILY_PROFILES } from "@/modules/occupations/families";
import { findOccupation, searchOccupations } from "@/modules/occupations/search";
import { Chip, PrimaryButton, Screen } from "@/components/onboarding/ui";

const ROLE_SUGGESTIONS = [
  "Software Engineer",
  "Nurse",
  "Accountant",
  "Truck Driver",
  "Electrician",
  "Teacher",
  "Chef",
  "Sales Representative",
];

export function RoleStep({
  userName,
  initial,
  pending,
  onPick,
  onUnknown,
}: {
  userName: string | null;
  initial: string;
  pending: boolean;
  onPick: (occupation: Occupation) => void;
  onUnknown: (role: string) => void;
}) {
  const [role, setRole] = useState(initial);
  const trimmed = role.trim();
  const matches = useMemo(() => searchOccupations(trimmed, 6), [trimmed]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    const known = findOccupation(trimmed);
    if (known) onPick(known);
    else onUnknown(trimmed);
  }

  const firstName = userName?.trim().split(" ")[0];
  return (
    <Screen
      title={firstName ? `${firstName}, what job are you looking for?` : "What job are you looking for?"}
      hint="Type the job title in English."
    >
      <form onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <Input
          autoFocus
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="Nurse, truck driver, accountant"
          maxLength={80}
          aria-autocomplete="list"
          className="h-16 rounded-2xl text-center text-h5"
        />
        {matches.length > 0 ? (
          <ul className="bg-card divide-y divide-border overflow-hidden rounded-card shadow-card" role="listbox">
            {matches.map((occupation) => (
              <li key={occupation.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={pending}
                  onClick={() => onPick(occupation)}
                  className="hover:bg-subtle flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors duration-150 disabled:opacity-60"
                >
                  <span className="text-body text-foreground">{occupation.en}</span>
                  <span className="text-muted-foreground shrink-0 text-body-sm">
                    {FAMILY_PROFILES[occupation.family].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : trimmed.length < 2 ? (
          <div className="flex flex-wrap justify-center gap-3">
            {ROLE_SUGGESTIONS.map((suggestion) => (
              <Chip key={suggestion} label={suggestion} selected={false} onClick={() => setRole(suggestion)} />
            ))}
          </div>
        ) : null}
        <div>
          <PrimaryButton type="submit" disabled={!trimmed} pending={pending}>
            Continue
          </PrimaryButton>
        </div>
      </form>
    </Screen>
  );
}
