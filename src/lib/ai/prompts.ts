import fs from "node:fs";
import path from "node:path";

export const RESEARCH_PROMPT_VERSION = "research-and-score@v1";
export const EMAIL_PROMPT_VERSION = "email-initial@v1";
export const EMAIL_FOLLOWUP_PROMPT_VERSION = "email-follow-up@v1";
export const EXTRACT_PEOPLE_PROMPT_VERSION = "extract-people@v1";
export const TRIAGE_PROMPT_VERSION = "triage@v1";
export const PROFILE_EXTRACT_PROMPT_VERSION = "profile/extract@v5";
export const CV_REVIEW_PROMPT_VERSION = "profile/cv-review@v2";
export const CLASSIFY_OCCUPATION_PROMPT_VERSION = "occupations/classify@v1";
export const JOB_SEARCH_PROFILE_PROMPT_VERSION = "jobs/search-profile@v3";
export const JOB_MATCH_PROMPT_VERSION = "jobs/match-and-explain@v4";
export const APPLICATION_ANALYSIS_PROMPT_VERSION =
  "jobs/application-analysis@v2";
export const APPLICATION_CV_SLOTS_PROMPT_VERSION = "jobs/tailored-cv-slots@v2";
export const APPLICATION_COVER_LETTER_PROMPT_VERSION =
  "jobs/cover-letter@v2";

export function loadPrompt(relativePath: string): string {
  const full = path.join(process.cwd(), "prompts", relativePath);
  return fs.readFileSync(full, "utf8");
}
