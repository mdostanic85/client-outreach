"use client";

/**
 * Back-compat shim — immersive search lives in search-experience.tsx.
 */
export {
  SearchExperience as SearchProgressModal,
  SearchExperience,
  type LiveSearchProgress,
  type SearchExperienceMode as SearchProgressMode,
  type SearchResultSummary,
} from "@/components/search-experience";
