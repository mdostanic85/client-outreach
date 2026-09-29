import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, jobs } from "@/db/schema";
import { canonicalJobUrl } from "@/modules/collectors/identity";
import { newId, nowIso } from "@/lib/ids";
import {
  jobFingerprint,
  normalizeCompanyName,
  type RawCollectedJob,
} from "@/modules/collectors/types";

export async function persistCollectedJob(
  job: RawCollectedJob,
  searchProfileVersion: number,
): Promise<{
 jobId: string; created: boolean }> {
  const db = getDb();
  let existing: typeof jobs.$inferSelect | undefined = (await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.source, job.source), eq(jobs.externalId, job.externalId))).limit(1))[0];

  // Exact canonical posting identity only; title similarity is not sufficient.
  // This also adopts legacy Apify IDs without replacing the job/application ID.
  if (!existing) {
    const canonical = canonicalJobUrl(job.sourceUrl);
    if (canonical) {
      const candidates = await db.select().from(jobs).where(or(eq(jobs.title, job.title), eq(jobs.sourceUrl, job.sourceUrl)));
      existing = candidates.find(candidate => canonicalJobUrl(candidate.sourceUrl) === canonical);
    }
  }

  if (existing) {
    await db.update(jobs)
      .set({
        title: job.title,
        description: job.description || existing.description,
        location: job.location ?? existing.location,
        remotePolicy: job.remotePolicy ?? existing.remotePolicy,
        employmentType: job.employmentType ?? existing.employmentType,
        salaryText: job.salaryText ?? existing.salaryText,
        postedAt: job.postedAt ?? existing.postedAt,
        updatedAt: nowIso(),
        status: "active",
      })
      .where(eq(jobs.id, existing.id));
    return { jobId: existing.id, created: false };
  }

  const normalized = normalizeCompanyName(job.companyName);
  let company = (await db
    .select()
    .from(companies)
    .where(eq(companies.normalizedName, normalized)).limit(1))[0];

  if (!company && job.companyDomain) {
    company = (await db
      .select()
      .from(companies)
      .where(eq(companies.domain, job.companyDomain)).limit(1))[0];
  }

  const now = nowIso();
  if (!company) {
    const companyId = newId("co");
    await db.insert(companies)
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
      });
    company = (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0]!;
  } else {
    await db.update(companies)
      .set({
        lastSeenAt: now,
        domain: company.domain ?? job.companyDomain ?? null,
      })
      .where(eq(companies.id, company.id));
  }

  const jobId = newId("job");
  await db.insert(jobs)
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
    });

  return { jobId, created: true };
}

export async function persistCollectedJobs(
  list: RawCollectedJob[],
  searchProfileVersion: number,
): Promise<{ created: number; updated: number; jobIds: string[] }> {
  let created = 0;
  let updated = 0;
  const jobIds: string[] = [];
  for (const job of list) {
    const result = await persistCollectedJob(job, searchProfileVersion);
    jobIds.push(result.jobId);
    if (result.created) created++;
    else updated++;
  }
  return { created, updated, jobIds };
}
