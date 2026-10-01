"use server";

import { revalidatePath } from "next/cache";
import { clearSecret, setSecret } from "@/lib/security/secrets";
import { runAction } from "@/lib/server-action";
import { runWorkerPipeline } from "@/modules/tracking/worker";
import { updateOpsChecklist, type OpsChecklist } from "./readiness";

/** Workspace administration (Admin page): owner only. */

function revalidateAfterSecretChange() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/queue");
}

/** Runs the full daily worker (companies + jobs) on demand. */
export async function runDailyPipelineAction() {
  return runAction("ops.runDailyPipeline", "owner", async () => {
    const result = await runWorkerPipeline();
    revalidatePath("/");
    revalidatePath("/admin");
    return { runId: result.runId };
  });
}

export async function updateOpsChecklistAction(input: Partial<OpsChecklist>) {
  return runAction("ops.updateChecklist", "owner", async () => {
    await updateOpsChecklist(input);
    revalidatePath("/admin");
  });
}

export async function saveSecretAction(name: string, value: string) {
  return runAction("ops.saveSecret", "owner", async () => {
    const source = setSecret(name, value);
    revalidateAfterSecretChange();
    return { source };
  });
}

export async function clearSecretAction(name: string) {
  return runAction("ops.clearSecret", "owner", async () => {
    clearSecret(name);
    revalidateAfterSecretChange();
  });
}
