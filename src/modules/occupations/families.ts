import { z } from "zod";

/**
 * Occupation family: the first signal we learn about a user. Search sources,
 * survey branches, scoring weights and the CV template all derive from it.
 *
 * v1 covers qualified work only (see docs/product/universal-jobs-plan.md,
 * "Odluke"): no production-line or unskilled hospitality family yet.
 */
export const OCCUPATION_FAMILIES = [
  "tech_digital",
  "office_business",
  "healthcare",
  "trades",
  "transport_logistics",
  "hospitality_retail",
  "education",
] as const;

export const OccupationFamilySchema = z.enum(OCCUPATION_FAMILIES);
export type OccupationFamily = z.infer<typeof OccupationFamilySchema>;

/** What proves someone can do the job — drives which materials we ask for. */
export type EvidenceStyle = "portfolio" | "track_record" | "credentials";

export type FamilyProfile = {
  label: string;
  examples: string;
  /** Junior / mid / senior / lead is a meaningful axis (tech, office). */
  usesLevels: boolean;
  /** Remote is common enough to offer it as a default option. */
  remoteCommon: boolean;
  evidence: EvidenceStyle;
  /** Portfolio / GitHub / personal site step is shown in onboarding. */
  asksForWebsite: boolean;
  /** Public Greenhouse / Lever / Ashby boards are worth scanning. */
  usesAtsBoards: boolean;
  /** Remotive categories that carry this family's remote roles. */
  remotiveCategories: string[];
};

export const FAMILY_PROFILES: Record<OccupationFamily, FamilyProfile> = {
  tech_digital: {
    label: "Tech and digital",
    examples: "developer, analyst, designer, QA",
    usesLevels: true,
    remoteCommon: true,
    evidence: "portfolio",
    asksForWebsite: true,
    usesAtsBoards: true,
    remotiveCategories: ["software-dev", "design", "data", "devops", "qa", "product"],
  },
  office_business: {
    label: "Office and business",
    examples: "accountant, HR, sales, marketing",
    usesLevels: true,
    remoteCommon: true,
    evidence: "track_record",
    asksForWebsite: false,
    usesAtsBoards: true,
    remotiveCategories: [
      "marketing",
      "sales-business",
      "finance-legal",
      "human-resources",
      "customer-support",
      "project-management",
      "writing",
    ],
  },
  healthcare: {
    label: "Healthcare",
    examples: "nurse, pharmacist, physiotherapist",
    usesLevels: false,
    remoteCommon: false,
    evidence: "credentials",
    asksForWebsite: false,
    usesAtsBoards: false,
    remotiveCategories: [],
  },
  trades: {
    label: "Skilled trades",
    examples: "electrician, mechanic, welder",
    usesLevels: false,
    remoteCommon: false,
    evidence: "credentials",
    asksForWebsite: false,
    usesAtsBoards: false,
    remotiveCategories: [],
  },
  transport_logistics: {
    label: "Transport and logistics",
    examples: "truck driver, warehouse lead, dispatcher",
    usesLevels: false,
    remoteCommon: false,
    evidence: "credentials",
    asksForWebsite: false,
    usesAtsBoards: false,
    remotiveCategories: [],
  },
  hospitality_retail: {
    label: "Hospitality and retail",
    examples: "chef, store manager, sommelier",
    usesLevels: false,
    remoteCommon: false,
    evidence: "track_record",
    asksForWebsite: false,
    usesAtsBoards: false,
    remotiveCategories: [],
  },
  education: {
    label: "Education",
    examples: "teacher, preschool teacher, trainer",
    usesLevels: false,
    remoteCommon: false,
    evidence: "credentials",
    asksForWebsite: false,
    usesAtsBoards: false,
    remotiveCategories: [],
  },
};

export function familyProfile(family: OccupationFamily | null | undefined): FamilyProfile {
  return FAMILY_PROFILES[family ?? "office_business"];
}
