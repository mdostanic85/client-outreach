"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPENSATION_CURRENCIES, formatCompensation, type CompensationExpectation } from "@/modules/profile/schemas";
import { cn } from "@/lib/utils";

import { linesToList } from "@/modules/profile/profile-form";

/** Form controls used on the Profile draft editor. */

/** Section block inside a profile tab — AutoSend / Apollo card grouping. */
export function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-subtle space-y-4 rounded-panel px-4 py-4 sm:px-5 sm:py-5">
      <header className="space-y-1">
        <h3 className="text-body font-medium text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-muted-foreground text-body-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-body font-medium sm:text-body-sm">
          {label}
        </Label>
        {hint ? (
          <p className="text-muted-foreground/80 text-body-sm leading-snug sm:text-body">
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function CompensationField({
  value,
  onChange,
  disabled,
}: {
  value: CompensationExpectation;
  onChange: (next: CompensationExpectation) => void;
  disabled?: boolean;
}) {
  const period =
    value.mode === "hourly" ? "/ hour" : value.mode === "monthly" ? "/ month" : "/ year";
  const summary = formatCompensation(value);

  function setAmount(
    key: "min" | "max",
    raw: string,
  ) {
    const trimmed = raw.trim().replace(/,/g, "");
    if (!trimmed) {
      onChange({ ...value, [key]: null });
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0) return;
    onChange({ ...value, [key]: n });
  }

  return (
    <Field
      label="Rate / salary"
      hint="Set a range, then choose per year, per month or per hour — and the currency."
      className="sm:col-span-2"
    >
      <div
        className={cn(
          "bg-subtle space-y-4 rounded-panel p-4 sm:p-5",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div
          className="bg-card grid grid-cols-3 gap-1 rounded-full p-1"
          role="group"
          aria-label="Pay type"
        >
          {(
            [
              { id: "salary", label: "Per year" },
              { id: "monthly", label: "Per month" },
              { id: "hourly", label: "Per hour" },
            ] as const
          ).map((opt) => {
            const active = value.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onChange({ ...value, mode: opt.id })}
                className={cn(
                  "h-9 rounded-full px-3 text-body-sm transition-colors duration-150 ease-standard",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:min-w-[12rem]">
            <span className="text-muted-foreground text-body-sm font-medium">
              Currency
            </span>
            <div
              className="bg-card flex flex-wrap gap-1 rounded-full p-1"
              role="group"
              aria-label="Currency"
            >
              {COMPENSATION_CURRENCIES.map((code) => {
                const active = value.currency === code;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => onChange({ ...value, currency: code })}
                    className={cn(
                      "h-9 min-w-[2.75rem] rounded-full px-3 text-body-sm tabular-nums transition-colors duration-150 ease-standard",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-body-sm font-medium">
                From
              </span>
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={value.min ?? ""}
                onChange={(e) => setAmount("min", e.target.value)}
                placeholder={value.mode === "hourly" ? "80" : "90000"}
              />
            </div>
            <span
              className="text-muted-foreground pb-3 text-body font-medium"
              aria-hidden
            >
              –
            </span>
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-body-sm font-medium">
                To
              </span>
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={value.max ?? ""}
                onChange={(e) => setAmount("max", e.target.value)}
                placeholder={value.mode === "hourly" ? "100" : "110000"}
              />
            </div>
          </div>

          <span className="text-muted-foreground pb-3 text-body font-medium sm:min-w-[4.5rem]">
            {period}
          </span>
        </div>

        {summary ? (
          <p className="text-muted-foreground text-body">
            Saved as{" "}
            <span className="text-foreground font-medium">{summary}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-body">
            Optional — leave blank if you prefer not to set a range yet.
          </p>
        )}
      </div>
    </Field>
  );
}

const EMPLOYMENT_TYPE_OPTIONS = [
  "Full-time",
  "Contract",
  "Freelance",
  "Part-time",
] as const;

export function EmploymentTypeField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const selected = linesToList(value);

  function toggle(option: string) {
    const exists = selected.some(
      (item) => item.toLowerCase() === option.toLowerCase(),
    );
    const next = exists
      ? selected.filter((item) => item.toLowerCase() !== option.toLowerCase())
      : [...selected, option];
    onChange(next.join("\n"));
  }

  return (
    <Field
      label="Employment type"
      hint="Select all that fit."
      className="sm:col-span-2"
    >
      <div className="flex flex-wrap gap-2">
        {EMPLOYMENT_TYPE_OPTIONS.map((option) => {
          const active = selected.some(
            (item) => item.toLowerCase() === option.toLowerCase(),
          );
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => toggle(option)}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-body-sm font-medium transition-colors",
                active
                  ? "border-brand bg-brand/15 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-foreground",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function ChipListField({
  label,
  value,
  onChange,
  disabled,
  placeholder = "Type and press Enter",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const items = linesToList(value);

  function commit(raw: string) {
    const next = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...items];
    for (const item of next) {
      if (!merged.some((x) => x.toLowerCase() === item.toLowerCase())) {
        merged.push(item);
      }
    }
    onChange(merged.join("\n"));
    setDraft("");
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index).join("\n"));
  }

  return (
    <Field label={label}>
      <div
        className={cn(
          "border-input bg-background focus-within:border-ring focus-within:ring-ring/40 flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-3",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="bg-card text-foreground border-border-strong inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-body-sm"
          >
            <span className="truncate">{item}</span>
            {!disabled ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => remove(i)}
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          placeholder={items.length === 0 ? placeholder : "Add…"}
          className="placeholder:text-muted-foreground min-w-[120px] flex-1 bg-transparent py-0.5 text-body outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && items.length > 0) {
              remove(items.length - 1);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
        />
      </div>
    </Field>
  );
}
