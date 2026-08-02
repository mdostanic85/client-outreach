"use client";

import { useRouter } from "next/navigation";
import { ModeSwitch } from "@/components/segmented-control";

export function LearningModeSwitch({ mode }: { mode: "jobs" | "clients" }) {
  const router = useRouter();

  return (
    <ModeSwitch
      ariaLabel="Improve view"
      value={mode}
      onChange={(next) => router.push(`/learning?mode=${next}`)}
      options={[
        {
          id: "jobs",
          label: "Jobs",
          description: "Log outcomes after you apply",
        },
        {
          id: "clients",
          label: "Companies",
          description: "See which sources work",
        },
      ]}
    />
  );
}
