import type { CvTemplate, OutputLanguage, PackageMarket } from "./schemas";

export type MarketLabels = {
  documentName: string;
  summaryHeading: string;
  experienceHeading: string;
  skillsHeading: string;
  educationHeading: string;
  projectsHeading: string;
  languagesHeading: string;
  certificationsHeading: string;
  licensesHeading: string;
  spellingHint: string;
};

const SERBIAN: MarketLabels = {
  documentName: "CV",
  summaryHeading: "Profil",
  experienceHeading: "Radno iskustvo",
  skillsHeading: "Veštine",
  educationHeading: "Obrazovanje",
  projectsHeading: "Izdvojeni radovi",
  languagesHeading: "Jezici",
  certificationsHeading: "Sertifikati",
  licensesHeading: "Dozvole i licence",
  spellingHint: "Write in Serbian, Latin script (latinica), standard ekavian.",
};

export function marketLabels(
  market: PackageMarket,
  language: OutputLanguage = "en",
  template?: CvTemplate,
): MarketLabels {
  if (language === "sr") return SERBIAN;
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
      licensesHeading: "Licences",
      spellingHint: "Use American English spelling (optimize, favor, organization).",
    };
  }
  const europe: MarketLabels = {
    documentName: "CV",
    summaryHeading: "Profile",
    experienceHeading: "Experience",
    skillsHeading: "Skills",
    educationHeading: "Education",
    projectsHeading: "Selected work",
    languagesHeading: "Languages",
    certificationsHeading: "Certifications",
    licensesHeading: "Licences",
    spellingHint:
      "Use international English spelling (optimise, favour, organisation) unless the role is clearly US-based.",
  };
  // Europass section names, as EU employers expect them.
  return template === "europass"
    ? {
        ...europe,
        summaryHeading: "About me",
        experienceHeading: "Work experience",
        educationHeading: "Education and training",
        skillsHeading: "Skills",
        languagesHeading: "Language skills",
        licensesHeading: "Driving licence",
      }
    : europe;
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
