/** Human labels for raw enum strings shown in the UI. */

export const LEAD_STATE_LABEL: Record<string, string> = {
  new: "New",
  suggested: "Suggested",
  researched: "Researched",
  saved_for_later: "Saved",
  accepted: "Accepted",
  draft_ready: "Draft ready",
  sent: "Sent",
  replied: "Replied",
  follow_up_due: "Follow-up due",
  in_conversation: "In conversation",
  closed_won: "Won",
  closed_lost: "Lost",
  rejected: "Rejected",
  suppressed: "Suppressed",
  triage_failed: "Triage failed",
};

export const POLICY_LABEL: Record<string, string> = {
  draft_allowed: "OK to draft",
  manual_review_required: "Manual review",
  prior_interaction_required: "Prior interaction",
  blocked: "Blocked",
  unknown: "Unknown policy",
};

export function labelLeadState(state: string) {
  return LEAD_STATE_LABEL[state] ?? state;
}

export function labelPolicy(policy: string) {
  return POLICY_LABEL[policy] ?? policy;
}
