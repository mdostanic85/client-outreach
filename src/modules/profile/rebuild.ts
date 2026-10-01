import { applySurveyToProfile, getSurvey } from "@/modules/onboarding/survey";
import { extractStructuredProfile, saveDraftProfileEdits } from "./extract";
import { getApprovedProfile, getStructuredProfileById } from "./queries";
import type { StructuredProfile } from "./schemas";

/**
 * Rebuilding the profile from sources (after adding a CV, a website or
 * LinkedIn) re-reads the documents. What the person told us themselves must
 * survive that: their survey answers and the preferences on the profile they
 * approved. Without this, a website that says "Remote" or names one specialty
 * would quietly replace the roles and places the person asked for.
 */

function uniqueCaseless(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Keeps the approved profile's preferences in a freshly extracted draft:
 * - roles, places, work types, languages, licences, certificates and work
 *   permits are combined (new sources add, never remove);
 * - the occupation stays as approved;
 * - pay, availability, commute and schedule stay when the new extraction
 *   says nothing about them;
 * - "too junior / too senior" lists stay as approved, so a new document can't
 *   add exclusions the person never saw.
 *
 * Skills, tools and project evidence come from the sources as extracted.
 */
export function carryOverPreferences(
  extracted: StructuredProfile,
  approved: StructuredProfile | null | undefined,
): StructuredProfile {
  if (!approved) return extracted;
  return {
    ...extracted,
    targetRoles: uniqueCaseless([...approved.targetRoles, ...extracted.targetRoles]),
    preferredLocations: uniqueCaseless([
      ...approved.preferredLocations,
      ...extracted.preferredLocations,
    ]),
    preferredEmploymentTypes: uniqueCaseless([
      ...approved.preferredEmploymentTypes,
      ...extracted.preferredEmploymentTypes,
    ]),
    timeZones: uniqueCaseless([...approved.timeZones, ...extracted.timeZones]),
    languages: uniqueCaseless([...approved.languages, ...extracted.languages]),
    licenses: uniqueCaseless([...approved.licenses, ...extracted.licenses]),
    certifications: uniqueCaseless([...approved.certifications, ...extracted.certifications]),
    workAuthorization: uniqueCaseless([
      ...approved.workAuthorization,
      ...extracted.workAuthorization,
    ]),
    rolesBelowLevel: approved.rolesBelowLevel,
    rolesAboveLevel: approved.rolesAboveLevel,
    occupationFamily: approved.occupationFamily ?? extracted.occupationFamily,
    occupationId: approved.occupationId ?? extracted.occupationId,
    compensation: extracted.compensation ?? approved.compensation,
    salaryOrRateExpectations:
      extracted.salaryOrRateExpectations ?? approved.salaryOrRateExpectations,
    availability: extracted.availability ?? approved.availability,
    commuteRadiusKm: extracted.commuteRadiusKm ?? approved.commuteRadiusKm,
    willingToTravel: extracted.willingToTravel ?? approved.willingToTravel,
    schedule: approved.schedule || extracted.schedule
      ? { ...approved.schedule, ...extracted.schedule }
      : undefined,
  };
}

/**
 * Re-reads every source into a new draft, then puts back the person's own
 * preferences (approved profile first, survey answers on top).
 */
export async function rebuildDraftProfile() {
  const extracted = await extractStructuredProfile();
  const [draft, approved, survey] = await Promise.all([
    getStructuredProfileById(extracted.profileId),
    getApprovedProfile(),
    getSurvey(),
  ]);
  if (!draft) throw new Error("Profile draft missing.");
  const profile = applySurveyToProfile(
    carryOverPreferences(draft.profile, approved?.profile),
    survey,
  );
  await saveDraftProfileEdits(extracted.profileId, profile);
  return { ...extracted, profile };
}
