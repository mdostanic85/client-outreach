"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SearchActivity } from "@/modules/search-experience/stages";

export type RadarActivity = SearchActivity & { id: number };

const TONE_DOT: Record<NonNullable<SearchActivity["tone"]>, string> = {
  strong: "bg-primary",
  worth: "bg-[var(--warn)]",
  weak: "bg-muted-foreground/45",
  neutral: "bg-[var(--chart-2)]",
  error: "bg-destructive/70",
};

const TONE_TEXT: Record<NonNullable<SearchActivity["tone"]>, string> = {
  strong: "text-primary",
  worth: "text-[var(--warn)]",
  weak: "text-muted-foreground",
  neutral: "text-foreground",
  error: "text-destructive",
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Blip = {
  item: RadarActivity;
  x: number;
  y: number;
  size: number;
};

/** Radius of the centre readout, as a fraction of the radar radius. */
const CORE = 0.42;

/**
 * Sources sit on the outer ring (bigger dot = more openings); scored roles are
 * pulled toward the centre by fit, so the best matches gather in the middle.
 */
function placeBlips(activity: RadarActivity[]): Blip[] {
  return activity
    .filter((a) => a.kind !== "filter")
    .slice(0, 28)
    .map((item) => {
      const h = hash(`${item.label}|${item.meta ?? ""}|${item.id}`);
      const angle = ((h % 360) * Math.PI) / 180;
      let radius: number;
      let size = 7;
      if (item.kind === "score") {
        const score = Number(item.value);
        radius = Number.isFinite(score) ? CORE + 0.06 + (1 - Math.min(100, score) / 100) * 0.4 : 0.88;
        size = item.tone === "strong" ? 10 : 8;
      } else {
        const found = Number.parseInt(item.value ?? "", 10);
        radius = 0.88 + ((h >> 9) % 8) / 100;
        size = Number.isFinite(found) && found > 0 ? Math.min(12, 6 + Math.sqrt(found) * 1.4) : 5;
      }
      return {
        item,
        x: 50 + Math.cos(angle) * radius * 50,
        y: 50 + Math.sin(angle) * radius * 50,
        size,
      };
    });
}

export function SearchRadar({
  activity,
  activeId,
  onActiveChange,
  value,
  caption,
}: {
  activity: RadarActivity[];
  activeId: number | null;
  onActiveChange: (id: number | null) => void;
  value: string;
  caption?: string;
}) {
  const blips = useMemo(() => placeBlips(activity), [activity]);
  const active = blips.find((b) => b.item.id === activeId) ?? null;

  return (
    <div className="search-radar @container absolute inset-0">
      <div className="search-radar-disc absolute inset-0 rounded-full" aria-hidden />
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" aria-hidden>
        {[29, 39.5, 49.5].map((r) => (
          <circle
            key={r}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            className="stroke-primary/25"
            strokeWidth="0.35"
            strokeDasharray={r === 49.5 ? undefined : "0.8 1.4"}
          />
        ))}
        <line x1="50" y1="1" x2="50" y2="28" className="stroke-primary/15" strokeWidth="0.3" />
        <line x1="50" y1="72" x2="50" y2="99" className="stroke-primary/15" strokeWidth="0.3" />
        <line x1="1" y1="50" x2="28" y2="50" className="stroke-primary/15" strokeWidth="0.3" />
        <line x1="72" y1="50" x2="99" y2="50" className="stroke-primary/15" strokeWidth="0.3" />
      </svg>
      <div className="search-radar-sweep absolute inset-0 rounded-full" aria-hidden />
      <div
        className="bg-background/85 border-primary/20 absolute rounded-full border backdrop-blur-sm"
        style={{ inset: `${50 - CORE * 50}%` }}
        aria-hidden
      />

      {blips.map(({ item, x, y, size }) => {
        const tone = item.tone ?? "neutral";
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className="search-radar-blip absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 outline-none"
            style={{ left: `${x}%`, top: `${y}%` }}
            onMouseEnter={() => onActiveChange(item.id)}
            onMouseLeave={() => onActiveChange(null)}
            onFocus={() => onActiveChange(item.id)}
            onBlur={() => onActiveChange(null)}
            aria-label={[item.label, item.meta, item.value].filter(Boolean).join(", ")}
          >
            <span
              className={cn(
                "search-radar-dot relative block rounded-full transition-transform duration-200",
                TONE_DOT[tone],
                isActive && "scale-[1.8] ring-2 ring-foreground/70",
                tone === "strong" && "search-radar-dot-strong",
              )}
              style={{ width: size, height: size }}
            >
              <span className={cn("search-radar-ping absolute inset-0 rounded-full", TONE_DOT[tone])} aria-hidden />
            </span>
          </button>
        );
      })}

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display tabular text-[clamp(2rem,18cqi,3.25rem)] leading-none font-semibold tracking-tight text-[var(--card-foreground)]">
          {value}
        </p>
        {caption ? (
          <p className="text-muted-foreground mt-2 max-w-[9rem] text-center text-[11px] leading-tight tracking-[0.08em] uppercase">
            {caption}
          </p>
        ) : null}
      </div>

      {/* Clamped so edge blips don't push the card off a phone screen. */}
      {active ? (
        <div
          className="bg-popover/95 border-border pointer-events-none absolute z-20 w-56 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border px-3 py-2 text-left backdrop-blur"
          style={{ left: `clamp(7rem, ${active.x}%, calc(100% - 7rem))`, top: `calc(${active.y}% + 14px)` }}
          role="status"
        >
          <p className="truncate text-[13px] font-medium text-[var(--card-foreground)]">{active.item.label}</p>
          {active.item.meta ? (
            <p className="text-muted-foreground truncate text-[12px]">{active.item.meta}</p>
          ) : null}
          {active.item.value ? (
            <p className={cn("font-mono mt-1 text-[12px]", TONE_TEXT[active.item.tone ?? "neutral"])}>
              {active.item.kind === "score" && Number.isFinite(Number(active.item.value))
                ? `Match ${active.item.value}`
                : active.item.value}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

