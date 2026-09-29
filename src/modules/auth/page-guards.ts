import { redirect } from "next/navigation";
import { currentUserId, isOwner } from "@/modules/auth/current-user";

/** Client-outreach and workspace-admin pages: owner only, everyone else goes to Today. */
export async function requireOwnerPage() {
  if (!(await isOwner(await currentUserId()))) redirect("/");
}
