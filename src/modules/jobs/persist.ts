import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, jobs } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import {
  jobFingerprint,
  normalizeCompanyName,
  type RawCollectedJob,
} from "@/modules/collectors/types";

export function persistCollectedJob(
  job: RawCollectedJob,
  searchProfileVersion: number,
): { jobId: string; created: boolean } {
  const db = getDb();
  const existing = db
    .select()
    .from(jobs)
    .where(and(eq(jobs.source, job.source), eq(jobs.externalId, job.externalId)))
    .get();

  if (existing) {
    db.update(jobs)
      .set({
        description: job.description || existing.description,
        location: job.location ?? existing.location,
        remotePolicy: job.remotePolicy ?? existing.remotePolicy,
        employmentType: job.employmentType ?? existing.employmentType,
        salaryText: job.salaryText ?? existing.salaryText,
        postedAt: job.postedAt ?? existing.postedAt,
        updatedAt: nowIso(),
        status: "active",
      })
      .where(eq(jobs.id, existing.id))
      .run();
    return { jobId: existing.id, created: false };
  }

  const normalized = normalizeCompanyName(job.companyName);
  let company = db
    .select()
    .from(companies)
    .where(eq(companies.normalizedName, normalized))
    .get();

  if (!company && job.companyDomain) {
    company = db
      .select()
      .from(companies)
      .where(eq(companies.domain, job.companyDomain))
      .get();
  }

  const now = nowIso();
  if (!company) {
    const companyId = newId("co");
    db.insert(companies)
      .values({
        id: companyId,
        name: job.companyName,
        normalizedName: normalized,
        domain: job.companyDomain ?? null,
        country: job.location ?? null,
        category: null,
        status: "new",
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .run();
    company = db.select().from(companies).where(eq(companies.id, companyId)).get()!;
  } else {
    db.update(companies)
      .set({
        lastSeenAt: now,
        domain: company.domain ?? job.companyDomain ?? null,
      })
      .where(eq(companies.id, company.id))
      .run();
  }

  const jobId = newId("job");
  db.insert(jobs)
    .values({
      id: jobId,
      companyId: company.id,
      title: job.title,
      description: job.description,
      location: job.location ?? null,
      remotePolicy: job.remotePolicy ?? null,
      employmentType: job.employmentType ?? null,
      salaryText: job.salaryText ?? null,
      source: job.source,
      externalId: job.externalId,
      sourceUrl: job.sourceUrl,
      postedAt: job.postedAt ?? null,
      status: "active",
      triageState: "discovered",
      searchProfileVersion,
      fingerprint: jobFingerprint({
        title: job.title,
        companyName: job.companyName,
        location: job.location,
      }),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { jobId, created: true };
}

export function persistCollectedJobs(
  list: RawCollectedJob[],
  searchProfileVersion: number,
): { created: number; updated: number; jobIds: string[] } {
  let created = 0;
  let updated = 0;
  const jobIds: string[] = [];
  for (const job of list) {
    const result = persistCollectedJob(job, searchProfileVersion);
    jobIds.push(result.jobId);
    if (result.created) created++;
    else updated++;
  }
  return { created, updated, jobIds };
}
