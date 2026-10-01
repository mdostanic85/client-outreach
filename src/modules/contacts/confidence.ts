/** How sure we are that a contact email is real and reachable. */
export const CONTACT_CONFIDENCE = [
  "published_personal",
  "published_generic",
  "manual_confirmed",
  "provider_verified",
  "pattern_unverified",
  "unknown",
] as const;

export type ContactConfidence = (typeof CONTACT_CONFIDENCE)[number];
