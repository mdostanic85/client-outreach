import { cache } from "react";
import { currentUserId, isOwner } from "@/modules/auth/current-user";
import { getSurvey, offersFreelance } from "./survey";

/**
 * The Clients (outreach) mode: owner-only (one shared mailbox) and only
 * for someone who said they take freelance work (plan phase 6).
 */
export const clientsModeEnabled = cache(async (): Promise<boolean> => {
  const [owner, survey] = await Promise.all([
    currentUserId().then(isOwner),
    getSurvey(),
  ]);
  return owner && offersFreelance(survey);
});
