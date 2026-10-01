"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import { deleteContactData } from "./delete";
import { writePersonalDataExport } from "./export";
import { runRetentionPrune } from "./retention";

/**
 * Privacy controls for client-outreach data (owner only). Export and delete
 * never check the AI budget: they must always work.
 */

export async function exportPersonalDataAction(input?: {
  leadId?: string;
  companyId?: string;
}) {
  return runAction("privacy.export", "owner", () =>
    writePersonalDataExport({ leadId: input?.leadId, companyId: input?.companyId }),
  );
}

export async function deleteContactAction(contactId: string, force = false) {
  return runAction("privacy.deleteContact", "owner", async () => {
    const result = await deleteContactData(contactId, { force });
    revalidatePath("/admin");
    revalidatePath("/");
    return result;
  });
}

export async function runRetentionPruneAction(dryRun = true) {
  return runAction("privacy.retentionPrune", "owner", async () => {
    const result = await runRetentionPrune({ dryRun });
    revalidatePath("/admin");
    return result;
  });
}
