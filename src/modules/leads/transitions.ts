/**
 * Lead state transition helpers (Validation MVP).
 */
import type { LeadState } from "./states";
import { LEAD_STATES } from "./states";

const ALLOWED: Partial<Record<LeadState, LeadState[]>> = {
  new: ["suggested", "triage_failed", "rejected", "suppressed"],
  triage_failed: ["suggested", "rejected", "suppressed"],
  researched: ["suggested", "accepted", "rejected", "saved_for_later"],
  suggested: ["accepted", "rejected", "saved_for_later", "suppressed"],
  saved_for_later: ["accepted", "rejected", "suggested", "suppressed"],
  accepted: ["draft_ready", "rejected", "suppressed"],
  draft_ready: ["sent", "accepted", "suppressed"],
  sent: ["replied", "follow_up_due", "in_conversation", "closed_lost", "suppressed"],
  follow_up_due: ["sent", "replied", "in_conversation", "closed_lost", "suppressed"],
  replied: ["in_conversation", "closed_won", "closed_lost", "follow_up_due"],
  in_conversation: ["closed_won", "closed_lost", "follow_up_due"],
  closed_won: [],
  closed_lost: [],
  rejected: ["suppressed"],
  suppressed: [],
};

export function isLeadState(value: string): value is LeadState {
  return (LEAD_STATES as readonly string[]).includes(value);
}

export function canTransition(from: LeadState, to: LeadState): boolean {
  if (from === to) return true;
  const next = ALLOWED[from];
  if (!next) return false;
  return next.includes(to);
}

export function assertTransition(from: LeadState, to: LeadState) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lead transition: ${from} → ${to}`);
  }
}
