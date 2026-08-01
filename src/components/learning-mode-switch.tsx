"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function LearningModeSwitch({ mode }: { mode: "jobs" | "clients" }) {
  return (
    <div className="bg-muted/60 inline-flex rounded-xl p-1">
      {(
        [
          ["jobs", "Jobs"],
          ["clients", "Clients"],
        ] as const
      ).map(([id, label]) => (
        <Link
          key={id}
          href={`/learning?mode=${id}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
            mode === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
