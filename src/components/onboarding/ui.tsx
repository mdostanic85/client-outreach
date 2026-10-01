"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CapsuleLabel } from "@/components/ui/capsule-label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Building blocks shared by every onboarding screen. */

/**
 * Setup progress: one dot per question group joined by a line that fills in
 * verdigris up to the current step. Advances only when the user answers.
 */
export function Stepper({
  steps,
  current,
  progress,
}: {
  steps: number;
  current: number;
  progress: number;
}) {
  const done = current < 0;
  const fill = done ? 100 : steps > 1 ? (current / (steps - 1)) * 100 : 100;
  return (
    <div
      className="relative flex h-3 flex-1 items-center justify-between"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <span aria-hidden className="bg-border-strong absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full" />
      <span
        aria-hidden
        className="bg-chart-1 absolute top-1/2 left-1 h-0.5 -translate-y-1/2 rounded-full transition-[width] duration-700 ease-enter motion-reduce:transition-none"
        style={{ width: `calc(${fill}% - ${fill > 0 ? "0.5rem" : "0rem"})` }}
      />
      {Array.from({ length: steps }, (_, index) => {
        const reached = done || index <= current;
        return (
          <span
            key={index}
            aria-hidden
            className={cn(
              "relative size-3 rounded-full border transition-colors duration-300 ease-standard",
              reached ? "border-chart-1 bg-chart-1" : "bg-card border-border-strong",
              index === current && "ring-chart-1/20 ring-4",
            )}
          />
        );
      })}
    </div>
  );
}

export function Screen({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {eyebrow ? (
        <p className="text-brand-ink mb-3 text-body-sm font-medium">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-h3 sm:text-h2 max-w-3xl font-medium text-foreground">
        {title}
      </h1>
      {hint ? (
        <p className="text-muted-foreground mt-4 max-w-xl text-body sm:text-body-lg">{hint}</p>
      ) : null}
      <div className="mt-10 w-full">{children}</div>
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
  pending,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  pending?: boolean;
  className?: string;
}) {
  return (
    <Button
      type={type}
      variant="capsule"
      disabled={disabled || pending}
      onClick={onClick}
      className={cn("mx-auto w-full max-w-sm", className)}
    >
      <CapsuleLabel
        className="w-full"
        icon={pending ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />}
      >
        {children}
      </CapsuleLabel>
    </Button>
  );
}


/** Single choice. Picking an option saves and advances — no extra Continue click. */
export function Choices<T extends string>({
  options,
  value,
  onPick,
  disabled,
}: {
  options: Array<{ id: T; label: string; detail?: string }>;
  value: T | undefined;
  onPick: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn("grid w-full gap-3", options.length > 3 ? "sm:grid-cols-2" : "mx-auto max-w-xl")}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onPick(option.id)}
            className={cn(
              "flex min-h-20 items-center justify-between gap-4 rounded-card border px-6 py-4 text-left text-h5 transition-colors duration-150 ease-standard disabled:opacity-60 sm:min-h-24 sm:text-h4",
              selected
                ? "border-brand bg-brand-wash text-foreground"
                : "bg-card text-foreground border-transparent hover:border-border-strong",
            )}
          >
            <span className="flex flex-col">
              {option.label}
              {option.detail ? (
                <span className="text-muted-foreground text-body-sm font-normal">{option.detail}</span>
              ) : null}
            </span>
            {selected ? (
              <span className="bg-brand-gradient text-on-brand grid size-7 shrink-0 place-items-center rounded-full">
                <Check className="size-4" strokeWidth={2.75} aria-hidden />
              </span>
            ) : (
              <span className="border-input size-7 shrink-0 rounded-full border" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-body transition-colors duration-150 ease-standard disabled:opacity-40",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border-strong hover:bg-subtle",
      )}
    >
      {selected ? <Check className="size-4 shrink-0" strokeWidth={2.75} aria-hidden /> : null}
      {label}
    </button>
  );
}


export function Ask({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-body-lg font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground mt-1 mb-4 text-body-sm">{hint}</p>
      {children}
    </div>
  );
}

export function OptionChips<T extends string>({
  options,
  value,
  onPick,
  disabled,
}: {
  options: Array<{ id: T; label: string }>;
  value: T | undefined;
  onPick: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3" role="radiogroup">
      {options.map((option) => (
        <Chip
          key={option.id}
          label={option.label}
          selected={option.id === value}
          disabled={disabled}
          onClick={() => onPick(option.id)}
        />
      ))}
    </div>
  );
}


/** A yes/no chip: selected = yes. */
export function Toggle({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return <Chip label={label} selected={Boolean(value)} onClick={() => onChange(!value)} />;
}

/** Free-text list: type and press Enter / Add. */
export function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(event: FormEvent) {
    event.preventDefault();
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v].slice(0, 20));
    setDraft("");
  }

  return (
    <div>
      <p className="mb-3 text-body font-medium">{label}</p>
      {values.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-body-sm"
              aria-label={`Remove ${v}`}
            >
              {v}
              <X className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={add} className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          maxLength={60}
          className="h-12"
        />
        <Button type="submit" variant="outline" size="lg" className="h-12" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

