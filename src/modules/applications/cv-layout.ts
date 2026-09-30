import type { OccupationFamily } from "@/modules/occupations/families";
import type { CvTemplate, TailoredCv } from "./schemas";

export type CvSectionId =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "licenses"
  | "certifications"
  | "education"
  | "languages";

/** Section order per template. The preview and the text export both follow it. */
export const CV_SECTION_ORDER: Record<CvTemplate, CvSectionId[]> = {
  projects: ["summary", "skills", "experience", "projects", "education", "certifications", "licenses", "languages"],
  chronological: ["summary", "experience", "skills", "licenses", "certifications", "education", "languages"],
  credentials: ["summary", "licenses", "certifications", "experience", "education", "skills", "languages"],
  europass: ["summary", "experience", "education", "languages", "skills", "licenses", "certifications"],
};

export const CV_TEMPLATE_LABELS: Record<CvTemplate, string> = {
  chronological: "Simple chronological",
  projects: "With projects",
  credentials: "Licences first",
  europass: "Europass",
};

/** Default layout for the occupation family (plan phase 5). */
export function cvTemplateFor(family: OccupationFamily | null | undefined): CvTemplate {
  switch (family) {
    case "tech_digital":
      return "projects";
    case "healthcare":
    case "education":
      return "credentials";
    case "trades":
    case "transport_logistics":
    case "hospitality_retail":
    case "office_business":
      return "chronological";
    default:
      return "projects";
  }
}

/** Sections that have content and are switched on, in template order. */
export function visibleCvSections(cv: TailoredCv): CvSectionId[] {
  const has: Record<CvSectionId, boolean> = {
    summary: Boolean(cv.summary),
    skills: cv.skills.length > 0,
    experience: cv.experience.some((e) => e.included),
    projects: cv.includeProjects && cv.projects.some((p) => p.included),
    licenses: cv.includeLicenses && cv.licenses.length > 0,
    certifications: cv.includeCertifications && cv.certifications.length > 0,
    education: cv.education.length > 0,
    languages: cv.includeLanguages && cv.languages.length > 0,
  };
  return CV_SECTION_ORDER[cv.template].filter((id) => has[id]);
}
