import type { PackageMarket } from "./schemas";

export type MarketLabels = {
  documentName: string;
  summaryHeading: string;
  experienceHeading: string;
  skillsHeading: string;
  educationHeading: string;
  projectsHeading: string;
  languagesHeading: string;
  certificationsHeading: string;
  spellingHint: string;
};

export function marketLabels(market: PackageMarket): MarketLabels {
  if (market === "us") {
    return {
      documentName: "Resume",
      summaryHeading: "Summary",
      experienceHeading: "Experience",
      skillsHeading: "Skills",
      educationHeading: "Education",
      projectsHeading: "Selected work",
      languagesHeading: "Languages",
      certificationsHeading: "Certifications",
      spellingHint: "Use American English spelling (optimize, favor, organization).",
    };
  }
  return {
    documentName: "CV",
    summaryHeading: "Profile",
    experienceHeading: "Experience",
    skillsHeading: "Skills",
    educationHeading: "Education",
    projectsHeading: "Selected work",
    languagesHeading: "Languages",
    certificationsHeading: "Certifications",
    spellingHint:
      "Use international English spelling (optimise, favour, organisation) unless the role is clearly US-based.",
  };
}

/** Suggest market from job/company country signals. Default europe. */
export function suggestMarket(input: {
  jobCountry?: string | null;
  jobLocation?: string | null;
  companyCountry?: string | null;
  salaryCurrency?: string | null;
}): PackageMarket {
  const blob = [
    input.jobCountry,
    input.jobLocation,
    input.companyCountry,
    input.salaryCurrency,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(united states|u\.?s\.?a?\.?|usa|new york|san francisco|california|texas|usd|\$)\b/.test(
      blob,
    )
  ) {
    return "us";
  }
  return "europe";
}
