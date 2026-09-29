import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, jobs, jobMatches } from "@/db/schema";
import { opportunitySignal } from "@/modules/matching/v2-signals";

export type JobReader = {
  list: (limit: number) => Promise<unknown>;
  detail: (id: string) => Promise<unknown>;
};

const publicFields = {
  id: jobs.id, title: jobs.title, company: companies.name, location: jobs.location,
  remotePolicy: jobs.remotePolicy, source: jobs.source, url: jobs.sourceUrl,
  postedAt: jobs.postedAt, state: jobs.triageState, outcome: jobs.outcome,
};

/** Deliberately omit CVs, contacts, private outcome notes, mail and credentials. */
export const jobReader: JobReader = {
  async list(limit) {
    return getDb().select(publicFields).from(jobs).leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(jobs.status, "active"), inArray(jobs.triageState, ["published", "saved", "interested"])))
      .orderBy(desc(jobs.publishedAt), jobs.id).limit(limit);
  },
  async detail(id) {
    const [job] = await getDb().select({ ...publicFields, description: jobs.description })
      .from(jobs).leftJoin(companies, eq(jobs.companyId, companies.id)).where(eq(jobs.id, id)).limit(1);
    if (!job) return null;
    const [match] = await getDb().select({ score: jobMatches.matchScore, eligibility: jobMatches.eligibility,
      evaluatedAt: jobMatches.createdAt }).from(jobMatches).where(eq(jobMatches.jobId, id))
      .orderBy(desc(jobMatches.createdAt)).limit(1);
    return { ...job, description: job.description.slice(0, 12000), match: match ?? null,
      opportunity: opportunitySignal(job) };
  },
};
