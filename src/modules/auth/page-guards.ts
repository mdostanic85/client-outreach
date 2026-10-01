import { redirect } from "next/navigation";
import { currentUserId, isOwner } from "@/modules/auth/current-user";
import { getSessionUser, type AuthUser } from "@/modules/auth/session";

/** Client-outreach and workspace-admin pages: owner only, everyone else goes to Today. */
export async function requireOwnerPage() {
  if (!(await isOwner(await currentUserId()))) redirect("/");
}

/**
 * For Route Handlers, which answer with their own status instead of
 * redirecting: the signed-in user and whether they own the workspace.
 */
export async function getRequestUser(): Promise<{ user: AuthUser; owner: boolean } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return { user, owner: await isOwner(user.id) };
}
