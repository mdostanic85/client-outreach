import { createHash } from "node:crypto";

export type OpportunityInput = {
  postedAt?: string | null;
  description: string;
  source: string;
  remotePolicy?: string | null;
};

/** A transparent listing-quality signal, never an interview probability. */
export function opportunitySignal(job: OpportunityInput, now = Date.now()) {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  let score = 0;
  const date = job.postedAt ? Date.parse(job.postedAt) : NaN;
  if (!Number.isFinite(date) || date > now) unknowns.push("publication_date");
  else {
    const days = (now - date) / 86400000;
    const freshness = days <= 3 ? 40 : days <= 7 ? 25 : days <= 30 ? 10 : 0;
    score += freshness;
    reasons.push(`freshness:${freshness}/40`);
  }
  if (["greenhouse", "lever", "ashby"].includes(job.source)) {
    score += 30;
    reasons.push("direct_ats:30/30");
  }
  if (job.description.length >= 300) { score += 20; reasons.push("description:20/20"); }
  else unknowns.push("detailed_description");
  if (/^remote$/i.test(job.remotePolicy ?? "")) { score += 10; reasons.push("explicit_remote:10/10"); }
  else unknowns.push("remote_eligibility");
  return { version: "opportunity-v1", score, reasons, unknowns };
}

/** Store in the existing promptVersion field, preserving the unique cache key. */
export function evaluationCacheVersion(input: {
  promptVersion: string;
  model: string;
  profileJson: string;
  searchProfileVersion: number;
  searchParams: unknown;
  job: { title: string; description: string; location?: string | null; remotePolicy?: string | null; employmentType?: string | null; salaryText?: string | null; postedAt?: string | null; source: string };
}): string {
  const { promptVersion, job, ...context } = input;
  const content = {
    title: job.title, description: job.description, location: job.location,
    remotePolicy: job.remotePolicy, employmentType: job.employmentType,
    salaryText: job.salaryText, postedAt: job.postedAt, source: job.source,
  };
  const hash = createHash("sha256").update(JSON.stringify({ ...context, content })).digest("hex").slice(0, 24);
  return `${promptVersion}:v2:${hash}`;
}
