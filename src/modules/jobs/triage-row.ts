import type { CompanySnapshot } from "@/modules/jobs/company-snapshot";
import type { RemoteFit } from "@/modules/matching/remote-fit";
import type { MatchDimensions } from "@/modules/matching/score";
import type { HomeAccess, WorkMode } from "@/modules/matching/work-location";

/** Client-safe job card props for Today / Interested lists. */
export type JobTriageRow = {
  jobId: string;
  title: string;
  companyName: string;
  location: string | null;
  remotePolicy: string | null;
  employmentType: string | null;
  source: string;
  sourceUrl: string;
  matchScore: number | null;
  /** Quick estimate shown when there is no AI score yet. */
  estimatedScore: number | null;
  estimateBasis: string | null;
  /** How the job is worked, and whether Serbia is possible. */
  workMode: WorkMode;
  homeAccess: HomeAccess;
  workReason: string;
  eligibility: string | null;
  recommendation: string | null;
  matchingReasons: string[];
  concerns: string[];
  remoteFit: RemoteFit;
  mainRisk: string | null;
  missingRequirements: string[];
  matchDimensions: MatchDimensions | null;
  remoteRequired: boolean;
  postedAt: string | null;
  triageState: string;
  companySnapshot: CompanySnapshot;
};
