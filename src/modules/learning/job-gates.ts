import { getDb } from "@/db/client";
import { jobOutcomeEvents, jobs } from "@/db/schema";

export type JobLearningGates = {
  triageDecisions: number;
  applications: number;
  applicationsWithOutcome: number;
  daysOfActivity: number;
  ready: boolean;
  missing: string[];
  /** Progress toward next strategy review cycle. */
  cycleProgress: { current: number; target: number };
};

const MIN_TRIAGE = 40;
const MIN_APPLICATIONS = 15;
const MIN_DAYS = 30;
const CYCLE_TARGET_APPLICATIONS = 30;

export function getJobLearningGates(): JobLearningGates {
  const db = getDb();
  const allJobs = db.select().from(jobs).all();
  const events = db.select().from(jobOutcomeEvents).all();

  const triageDecisions = allJobs.filter((j) =>
    ["interested", "saved", "rejected", "applied"].includes(j.triageState),
  ).length;

  const applications = allJobs.filter((j) => j.triageState === "applied").length;
  const applicationsWithOutcome = allJobs.filter(
    (j) => j.triageState === "applied" && j.outcome && j.outcome !== "none",
  ).length;

  const times = [
    ...allJobs.map((j) => j.updatedAt),
    ...events.map((e) => e.createdAt),
  ]
    .filter(Boolean)
    .sort();

  let daysOfActivity = 0;
  if (times.length >= 2) {
    const first = Date.parse(times[0]!);
    const last = Date.parse(times[times.length - 1]!);
    daysOfActivity = Math.max(
      1,
      Math.floor((last - first) / (24 * 60 * 60 * 1000)) + 1,
    );
  } else if (times.length === 1) {
    daysOfActivity = 1;
  }

  const daysOk = daysOfActivity >= MIN_DAYS;
  const triageOk = triageDecisions >= MIN_TRIAGE;
  const appsOk = applications >= MIN_APPLICATIONS;
  const primaryMet = daysOk || triageOk || appsOk;
  const hasSignal = applicationsWithOutcome >= 1 || triageDecisions >= 10;
  const ready = primaryMet && hasSignal;

  const missing: string[] = [];
  if (!primaryMet) {
    missing.push(
      `need ${MIN_DAYS}d activity OR ${MIN_TRIAGE} triage OR ${MIN_APPLICATIONS} apps (have ${daysOfActivity}d / ${triageDecisions} triage / ${applications} apps)`,
    );
  }
  if (!hasSignal) {
    missing.push("need ≥1 post-apply outcome or ≥10 triage decisions");
  }

  return {
    triageDecisions,
    applications,
    applicationsWithOutcome,
    daysOfActivity,
    ready,
    missing,
    cycleProgress: {
      current: applications,
      target: CYCLE_TARGET_APPLICATIONS,
    },
  };
}

export function assertJobGatesOrPreview(force = false) {
  const gates = getJobLearningGates();
  if (!gates.ready && !force) {
    throw new Error(
      `Job learning gates not met: ${gates.missing.join("; ")}. Pass force=true for preview.`,
    );
  }
  return gates;
}
