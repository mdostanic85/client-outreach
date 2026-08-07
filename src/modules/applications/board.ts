import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { applicationPackages, companies, jobs } from "@/db/schema";
import {
  PackageMailStatusSchema,
  type PackageMailStatus,
} from "./schemas";

const WAITING_AFTER_DAYS = 5;

export type ApplicationMailColumn = "sent" | "waiting" | "follow_up";

export type ApplicationMailCard = {
  packageId: string;
  jobId: string;
  companyName: string;
  jobTitle: string;
  mailStatus: PackageMailStatus;
  column: ApplicationMailColumn;
  sentAt: string | null;
  emailTo: string | null;
};

export type ApplicationMailBoard = {
  sent: ApplicationMailCard[];
  waiting: ApplicationMailCard[];
  follow_up: ApplicationMailCard[];
};

function columnFor(row: {
  mailStatus: string;
  sentAt: string | null;
}): ApplicationMailColumn | null {
  const status = PackageMailStatusSchema.catch("none").parse(row.mailStatus);
  if (status === "follow_up") return "follow_up";
  if (status === "waiting") return "waiting";
  if (status === "sent") {
    if (!row.sentAt) return "sent";
    const ageMs = Date.now() - new Date(row.sentAt).getTime();
    const days = ageMs / (24 * 60 * 60 * 1000);
    return days >= WAITING_AFTER_DAYS ? "waiting" : "sent";
  }
  if (status === "closed") return null;
  return null;
}

/** Active packages that have been sent (or need follow-up). */
export async function listApplicationMailBoard(): Promise<ApplicationMailBoard> {
  const db = getDb();
  const rows = await db
    .select({
      packageId: applicationPackages.id,
      jobId: applicationPackages.jobId,
      companyId: applicationPackages.companyId,
      mailStatus: applicationPackages.mailStatus,
      sentAt: applicationPackages.sentAt,
      emailTo: applicationPackages.emailTo,
      jobTitle: jobs.title,
      jobCompanyId: jobs.companyId,
      companyName: companies.name,
    })
    .from(applicationPackages)
    .innerJoin(jobs, eq(applicationPackages.jobId, jobs.id))
    .leftJoin(companies, eq(applicationPackages.companyId, companies.id))
    .where(
      and(
        ne(applicationPackages.state, "superseded"),
        ne(applicationPackages.mailStatus, "none"),
      ),
    )
    .orderBy(desc(applicationPackages.sentAt));

  const board: ApplicationMailBoard = {
    sent: [],
    waiting: [],
    follow_up: [],
  };

  // Resolve company names when package.companyId is null but job has one
  const companyIds = [
    ...new Set(
      rows
        .filter((r) => !r.companyName && r.jobCompanyId)
        .map((r) => r.jobCompanyId!),
    ),
  ];
  const companyMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const allCompanies = await db.select().from(companies);
    for (const c of allCompanies) {
      if (companyIds.includes(c.id)) companyMap.set(c.id, c.name);
    }
  }

  for (const row of rows) {
    const column = columnFor(row);
    if (!column) continue;
    const companyName =
      row.companyName ??
      (row.jobCompanyId ? companyMap.get(row.jobCompanyId) : null) ??
      "Company";
    const card: ApplicationMailCard = {
      packageId: row.packageId,
      jobId: row.jobId,
      companyName,
      jobTitle: row.jobTitle,
      mailStatus: PackageMailStatusSchema.catch("sent").parse(row.mailStatus),
      column,
      sentAt: row.sentAt,
      emailTo: row.emailTo,
    };
    board[column].push(card);
  }

  return board;
}

export { WAITING_AFTER_DAYS };
