import type { CompanySnapshot } from "@/modules/jobs/company-snapshot";
import type { RemoteFit } from "@/modules/matching/remote-fit";
import type { MatchDimensions } from "@/modules/matching/score";

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
