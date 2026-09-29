import { createHash } from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  applicationPackages,
  companies,
  jobs,
  jobMatches,
  researchBriefs,
} from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { getSessionUser } from "@/modules/auth/session";
import { getJobDetail } from "@/modules/jobs/queries";
import { getApprovedProfile } from "@/modules/profile/queries";
import type { ApplicationEmailDraft } from "./application-email";
import type { ContactHeader } from "./base-cv";
import {
  packageFilenameBase,
  packageToPlainText,
} from "./export-text";
import { validateGrounding } from "./grounding";
import { suggestMarket } from "./market";
import {
  personalizeApplicationPackage,
  regenerateCoverLetter,
  regenerateCvSummary,
} from "./personalize";
import {
  CoverLetterSchema,
  PackageMailStatusSchema,
  PackageMarketSchema,
  PackageStateSchema,
  TailoredCvSchema,
  coverLetterToPlainText,
  parseCoverLetterFromText,
  parseTailoredCv,
  serializeCoverLetter,
  type CoverLetter,
  type PackageMailStatus,
  type PackageMarket,
  type PackageState,
  type TailoredCv,
  type GroundingReport,
  type PackageAnalysis,
  type PackageWarning,
} from "./schemas";
import { getUserSettings } from "@/modules/settings/user-settings";
import { currentUserId, owned } from "@/modules/auth/current-user";

export type ApplicationPackageRow = typeof applicationPackages.$inferSelect;

export type ApplicationPackageView = ApplicationPackageRow & {
  cv: TailoredCv;
  letter: CoverLetter;
  analysis: PackageAnalysis;
  grounding: GroundingReport;
  warnings: PackageWarning[];
  jobTitle: string;
  companyName: string;
  sourceUrl: string;
  marketLabel: PackageMarket;
  mailStatusLabel: PackageMailStatus;
  email: ApplicationEmailDraft;
};

function packageContentHash(cv: TailoredCv, letter: CoverLetter): string {
  return createHash("sha256")
    .update(JSON.stringify(cv))
    .update("\n")
    .update(serializeCoverLetter(letter))
    .digest("hex");
}

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

async function resolveContactHeader(): Promise<ContactHeader> {
  const user = await getSessionUser();
  const setting = (await getUserSettings());
  const links: string[] = [];
  // Prefer explicit links later; for now leave empty — user can edit in UI.
  return {
    fullName: user?.name?.trim() || "Your Name",
    email: user?.email,
    location: undefined,
    links,
    // profileMd unused for name
    ...(setting ? {} : {}),
  };
}

export async function getActivePackageForJob(
  jobId: string,
): Promise<ApplicationPackageView | null> {
  const row = (await getDb()
    .select()
    .from(applicationPackages)
    .where(
      and(await owned(applicationPackages),
        eq(applicationPackages.jobId, jobId),
        ne(applicationPackages.state, "superseded"),
      ),
    )
    .orderBy(desc(applicationPackages.version))
    .limit(1))[0];
  if (!row) return null;
  return toView(row);
}

export async function getPackageById(
  id: string,
): Promise<ApplicationPackageView | null> {
  const row = (await getDb()
    .select()
    .from(applicationPackages)
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, id)))
    .limit(1))[0];
  if (!row) return null;
  return toView(row);
}

export type PackageListMeta = {
  state: PackageState;
  mailStatus: PackageMailStatus;
  packageId: string;
};

export async function listPackageStatesForJobs(
  jobIds: string[],
): Promise<Record<string, PackageState>> {
  const meta = await listPackageMetaForJobs(jobIds);
  const out: Record<string, PackageState> = {};
  for (const [jobId, m] of Object.entries(meta)) {
    out[jobId] = m.state;
  }
  return out;
}

export async function listPackageMetaForJobs(
  jobIds: string[],
): Promise<Record<string, PackageListMeta>> {
  if (jobIds.length === 0) return {};
  const db = getDb();
  const rows = await db.select().from(applicationPackages).where(await owned(applicationPackages));
  const out: Record<string, PackageListMeta> = {};
  for (const jobId of jobIds) {
    const active = rows
      .filter((r) => r.jobId === jobId && r.state !== "superseded")
      .sort((a, b) => b.version - a.version)[0];
    if (active) {
      out[jobId] = {
        state: PackageStateSchema.catch("draft").parse(active.state),
        mailStatus: PackageMailStatusSchema.catch("none").parse(
          active.mailStatus,
        ),
        packageId: active.id,
      };
    }
  }
  return out;
}

async function toView(row: ApplicationPackageRow): Promise<ApplicationPackageView> {
  const job = (await getDb().select().from(jobs).where(and(await owned(jobs), eq(jobs.id, row.jobId))).limit(1))[0];
  let companyName = "Company";
  if (row.companyId) {
    const company = (await getDb()
      .select()
      .from(companies)
      .where(eq(companies.id, row.companyId))
      .limit(1))[0];
    if (company) companyName = company.name;
  } else if (job?.companyId) {
    const company = (await getDb()
      .select()
      .from(companies)
      .where(eq(companies.id, job.companyId))
      .limit(1))[0];
    if (company) companyName = company.name;
  }

  const letter = parseCoverLetterFromText(
    row.letterFinal || row.letterGenerated,
  );
  const cv = parseTailoredCv(row.cvJson);
  const jobTitle = job?.title ?? "Role";

  return {
    ...row,
    cv,
    letter,
    analysis: parseJsonSafe(row.analysisJson, {
      roleSummary: "",
      mustHaves: [],
      niceToHaves: [],
      fitStrengths: [],
      gaps: [],
      recommendedSkillOrder: [],
      recommendedProjectIds: [],
      recommendedBulletIds: [],
    }),
    grounding: parseJsonSafe(row.groundingJson, {
      ok: true,
      usedFields: [],
      usedProjectIds: [],
      usedCompanyFacts: [],
      rejectedClaims: [],
    }),
    warnings: parseJsonSafe(row.warningsJson, []),
    jobTitle,
    companyName,
    sourceUrl: job?.sourceUrl ?? "#",
    marketLabel: PackageMarketSchema.catch("europe").parse(row.market),
    mailStatusLabel: PackageMailStatusSchema.catch("none").parse(
      row.mailStatus,
    ),
    email: {
      to: row.emailTo?.trim() ?? "",
      subject:
        row.emailSubject?.trim() ||
        `${jobTitle} — ${cv.fullName || letter.fullName}`,
      body:
        row.emailBody?.trim() ||
        coverLetterToPlainText(letter),
    },
  };
}

export async function generatePackageForJob(input: {
  jobId: string;
  market?: PackageMarket;
  marketConfirmed?: boolean;
}): Promise<ApplicationPackageView> {
  const approved = await getApprovedProfile();
  if (!approved) {
    throw new Error(
      "Approve your professional profile on /profile before preparing a package.",
    );
  }

  const detail = await getJobDetail(input.jobId);
  if (!detail) throw new Error("Job not found");
  const triage = detail.job.triageState;
  if (triage !== "interested" && triage !== "applied") {
    throw new Error("Mark the job as Interested before preparing a package.");
  }

  const db = getDb();
  const job = detail.job;
  const company = detail.company ?? undefined;

  const match = (await db
    .select()
    .from(jobMatches)
    .where(and(await owned(jobMatches), eq(jobMatches.jobId, input.jobId)))
    .orderBy(desc(jobMatches.createdAt))
    .limit(1))[0];

  let companySummary: string | null = null;
  if (job.companyId) {
    const brief = (await db
      .select()
      .from(researchBriefs)
      .where(eq(researchBriefs.companyId, job.companyId))
      .orderBy(desc(researchBriefs.createdAt))
      .limit(1))[0];
    if (brief) {
      try {
        const result = JSON.parse(brief.resultJson) as {
          companySummary?: string;
        };
        companySummary = result.companySummary ?? null;
      } catch {
        companySummary = null;
      }
    }
  }

  const suggested = suggestMarket({
    jobCountry: company?.country,
    jobLocation: job.location,
    companyCountry: company?.country,
    salaryCurrency: job.salaryCurrency,
  });
  const market = input.market ?? suggested;

  const contact = await resolveContactHeader();

  const matchingReasons = (() => {
    try {
      return JSON.parse(match?.matchingReasonsJson || "[]") as string[];
    } catch {
      return detail.matchingReasons;
    }
  })();
  const concerns = (() => {
    try {
      return JSON.parse(match?.concernsJson || "[]") as string[];
    } catch {
      return detail.concerns;
    }
  })();

  const personalized = await personalizeApplicationPackage({
    profile: approved.profile,
    contact: {
      ...contact,
      location:
        contact.location ??
        approved.profile.preferredLocations[0] ??
        undefined,
    },
    market,
    marketConfirmed: input.marketConfirmed ?? Boolean(input.market),
    job: {
      title: job.title,
      description: job.description || "",
      location: job.location,
      companyName: company?.name ?? "Unknown",
      matchingReasons,
      concerns,
      missingRequirements: detail.missingRequirements,
    },
    companySummary,
  });

  // Supersede prior active packages for this job.
  const now = nowIso();
  const prior = await db
    .select()
    .from(applicationPackages)
    .where(and(await owned(applicationPackages), eq(applicationPackages.jobId, input.jobId)));
  const nextVersion =
    prior.reduce((max, r) => Math.max(max, r.version), 0) + 1;
  for (const row of prior) {
    if (row.state !== "superseded") {
      await db
        .update(applicationPackages)
        .set({ state: "superseded", updatedAt: now })
        .where(and(await owned(applicationPackages), eq(applicationPackages.id, row.id)));
    }
  }

  const letterJson = serializeCoverLetter(personalized.letter);
  const id = newId("apkg");
  await db.insert(applicationPackages).values({
      userId: await currentUserId(),
    id,
    jobId: input.jobId,
    companyId: job.companyId,
    profileVersion: approved.version,
    market,
    state: "draft",
    version: nextVersion,
    contentHash: null,
    analysisJson: JSON.stringify(personalized.analysis),
    cvJson: JSON.stringify(personalized.cv),
    letterGenerated: letterJson,
    letterFinal: letterJson,
    groundingJson: JSON.stringify(personalized.grounding),
    warningsJson: JSON.stringify(personalized.warnings),
    model: personalized.model,
    promptVersion: personalized.promptVersion,
    approvedAt: null,
    emailTo: null,
    emailSubject: null,
    emailBody: null,
    mailStatus: "none",
    sentAt: null,
    repliedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const view = await getPackageById(id);
  if (!view) throw new Error("Failed to load created package");
  return view;
}

export async function savePackageCv(
  packageId: string,
  cv: TailoredCv,
): Promise<ApplicationPackageView> {
  const db = getDb();
  const row = (await db
    .select()
    .from(applicationPackages)
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)))
    .limit(1))[0];
  if (!row) throw new Error("Package not found");
  if (row.state === "superseded") throw new Error("Package was superseded");

  const parsed = TailoredCvSchema.parse(cv);
  const now = nowIso();
  await db
    .update(applicationPackages)
    .set({
      cvJson: JSON.stringify(parsed),
      state: row.state === "prepared" || row.state === "approved" ? "draft" : row.state,
      contentHash: null,
      approvedAt: null,
      updatedAt: now,
    })
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)));

  const view = await getPackageById(packageId);
  if (!view) throw new Error("Package not found after save");
  return view;
}

export async function savePackageLetter(
  packageId: string,
  letter: CoverLetter,
): Promise<ApplicationPackageView> {
  const db = getDb();
  const row = (await db
    .select()
    .from(applicationPackages)
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)))
    .limit(1))[0];
  if (!row) throw new Error("Package not found");
  if (row.state === "superseded") throw new Error("Package was superseded");

  const parsed = CoverLetterSchema.parse(letter);
  const now = nowIso();
  await db
    .update(applicationPackages)
    .set({
      letterFinal: serializeCoverLetter(parsed),
      state: row.state === "prepared" || row.state === "approved" ? "draft" : row.state,
      contentHash: null,
      approvedAt: null,
      updatedAt: now,
    })
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)));

  const view = await getPackageById(packageId);
  if (!view) throw new Error("Package not found after save");
  return view;
}

export async function savePackageEmail(
  packageId: string,
  email: ApplicationEmailDraft,
): Promise<ApplicationPackageView> {
  const db = getDb();
  const row = (await db
    .select()
    .from(applicationPackages)
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)))
    .limit(1))[0];
  if (!row) throw new Error("Package not found");
  if (row.state === "superseded") throw new Error("Package was superseded");
  if (
    row.mailStatus === "sent" ||
    row.mailStatus === "waiting" ||
    row.mailStatus === "follow_up"
  ) {
    throw new Error("Email already sent — disconnect is not available here");
  }

  const now = nowIso();
  await db
    .update(applicationPackages)
    .set({
      emailTo: email.to.trim(),
      emailSubject: email.subject.trim(),
      emailBody: email.body.trim(),
      updatedAt: now,
    })
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)));

  const view = await getPackageById(packageId);
  if (!view) throw new Error("Package not found after save");
  return view;
}

export async function approvePackage(
  packageId: string,
): Promise<ApplicationPackageView> {
  const view = await getPackageById(packageId);
  if (!view) throw new Error("Package not found");
  if (view.state === "superseded") throw new Error("Package was superseded");

  const profile = await getApprovedProfile();
  if (!profile) throw new Error("Approve your profile before approving a package");
  const grounding = validateGrounding({ profile: profile.profile, cv: view.cv, letter: view.letter,
    companyName: view.companyName, jobTitle: view.jobTitle });
  if (!grounding.ok) throw new Error(grounding.rejectedClaims.join("; "));
  // Revalidate edited documents; stale generated grounding warnings must not block a corrected CV.
  const warnings = view.warnings.filter(w => w.code !== "grounding_failed");
  const block = warnings.find((w) => w.severity === "block");
  if (block) {
    throw new Error(block.message);
  }

  const hash = packageContentHash(view.cv, view.letter);
  const now = nowIso();
  await getDb()
    .update(applicationPackages)
    .set({
      state: "approved",
      groundingJson: JSON.stringify(grounding),
      warningsJson: JSON.stringify(warnings),
      contentHash: hash,
      approvedAt: now,
      updatedAt: now,
    })
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)));

  const next = await getPackageById(packageId);
  if (!next) throw new Error("Package not found after approve");
  return next;
}

export async function markPackagePrepared(
  packageId: string,
): Promise<ApplicationPackageView> {
  const view = await getPackageById(packageId);
  if (!view) throw new Error("Package not found");
  if (view.state !== "approved" && view.state !== "prepared") {
    throw new Error("Approve the package before marking it prepared.");
  }
  const hash = packageContentHash(view.cv, view.letter);
  if (view.contentHash && view.contentHash !== hash) {
    throw new Error("Package changed since approval — approve again.");
  }

  const now = nowIso();
  await getDb()
    .update(applicationPackages)
    .set({
      state: "prepared",
      contentHash: hash,
      approvedAt: view.approvedAt ?? now,
      updatedAt: now,
    })
    .where(and(await owned(applicationPackages), eq(applicationPackages.id, packageId)));

  const next = await getPackageById(packageId);
  if (!next) throw new Error("Package not found after prepare");
  return next;
}

export async function exportPackageText(packageId: string): Promise<{
  text: string;
  filename: string;
}> {
  const view = await getPackageById(packageId);
  if (!view) throw new Error("Package not found");
  const text = packageToPlainText({
    cv: view.cv,
    letter: view.letter,
    market: view.marketLabel,
    companyName: view.companyName,
    jobTitle: view.jobTitle,
  });
  const filename = `${packageFilenameBase({
    fullName: view.cv.fullName,
    companyName: view.companyName,
    jobTitle: view.jobTitle,
  })}_application.txt`;
  return { text, filename };
}

export async function regeneratePackageSlot(input: {
  packageId: string;
  slot: "summary" | "letter";
}): Promise<ApplicationPackageView> {
  const view = await getPackageById(input.packageId);
  if (!view) throw new Error("Package not found");
  const approved = await getApprovedProfile();
  if (!approved) throw new Error("Approved profile required");

  const job = (await getDb()
    .select()
    .from(jobs)
    .where(and(await owned(jobs), eq(jobs.id, view.jobId)))
    .limit(1))[0];
  if (!job) throw new Error("Job not found");

  if (input.slot === "summary") {
    const summary = await regenerateCvSummary({
      profile: approved.profile,
      cv: view.cv,
      job: {
        title: job.title,
        companyName: view.companyName,
        description: job.description || "",
      },
      market: view.marketLabel,
    });
    return savePackageCv(input.packageId, { ...view.cv, summary });
  }

  const letter = await regenerateCoverLetter({
    profile: approved.profile,
    cv: view.cv,
    job: {
      title: job.title,
      companyName: view.companyName,
      description: job.description || "",
    },
    market: view.marketLabel,
    fullName: view.cv.fullName,
  });
  return savePackageLetter(input.packageId, letter);
}

export { coverLetterToPlainText, packageContentHash };
