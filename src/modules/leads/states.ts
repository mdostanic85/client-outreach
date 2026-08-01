/** Explicit lead states for Validation MVP (Phase 1). */
export const LEAD_STATES = [
  "new",
  "triage_failed",
  "suggested",
  "saved_for_later",
  "accepted",
  "draft_ready",
  "sent",
  "replied",
  "follow_up_due",
  "in_conversation",
  "closed_won",
  "closed_lost",
  "rejected",
  "suppressed",
  // Phase 0 transitional — treated as pre-suggested researched
  "researched",
] as const;

export type LeadState = (typeof LEAD_STATES)[number];

export const ACTIVE_OUTREACH_STATES: LeadState[] = [
  "accepted",
  "draft_ready",
  "sent",
  "replied",
  "follow_up_due",
  "in_conversation",
];

export const SUPPRESSION_ELIGIBLE_STATES: LeadState[] = [
  "sent",
  "replied",
  "follow_up_due",
  "in_conversation",
  "closed_won",
  "closed_lost",
  "rejected",
  "suppressed",
];
