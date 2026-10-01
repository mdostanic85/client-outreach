import type { ActionRunner } from "@/components/use-action-runner";
import type { getLeadDetail } from "@/modules/leads/queries";

/**
 * The lead screen walks one company through five stages. The stage follows
 * the lead's state; the user can step back to any unlocked stage.
 */

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;
export type LeadContact = LeadDetail["contacts"][number];
export type LeadDraft = LeadDetail["drafts"][number];

export type Stage = "review" | "contact" | "compose" | "approve" | "outcome";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "contact", label: "Contact" },
  { id: "compose", label: "Compose" },
  { id: "approve", label: "Approve" },
  { id: "outcome", label: "Outcome" },
];

export const DECISION_STATES = ["suggested", "researched", "saved_for_later", "new"];
const OUTCOME_STATES = [
  "sent",
  "follow_up_due",
  "replied",
  "in_conversation",
  "closed_won",
  "closed_lost",
];

/** Where the lead's current state puts it. */
export function resolveStage(detail: LeadDetail): Stage {
  const state = detail.lead.state;
  if (DECISION_STATES.includes(state)) return "review";
  if (OUTCOME_STATES.includes(state)) return "outcome";

  const hasEmail = detail.contacts.some((c) => c.email);
  const draft = detail.drafts[0];

  if (!hasEmail) return "contact";
  if (draft?.state === "approved") return "approve";
  if (draft || state === "draft_ready" || state === "accepted") return "compose";
  return "contact";
}

/** Contacts can be added once the lead is accepted, and until it closes. */
export function isContactEditable(state: string): boolean {
  return (
    state === "accepted" ||
    state === "draft_ready" ||
    state === "sent" ||
    state === "follow_up_due" ||
    state === "replied"
  );
}

/** First contact with an email, else the first contact. */
export function defaultContactId(detail: LeadDetail): string {
  return detail.contacts.find((c) => c.email)?.id ?? detail.contacts[0]?.id ?? "";
}

/** What every stage receives from the workspace. */
export type StageProps = {
  detail: LeadDetail;
  pending: boolean;
  run: ActionRunner["run"];
  onShowStage: (stage: Stage) => void;
};
