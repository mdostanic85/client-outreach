"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import {
  setTodayMode,
  updateOutreachSettings,
  type OutreachSettingsInput,
  type TodayMode,
} from "./user-settings";

/**
 * Outreach voice, send policy and the AI budget are workspace controls, so
 * only the owner may change them (the page is owner-only too, but the action
 * is reachable without it).
 */
export async function updateSettingsAction(input: OutreachSettingsInput) {
  return runAction("settings.updateOutreach", "owner", async () => {
    await updateOutreachSettings(input);
    revalidatePath("/settings/voice");
    revalidatePath("/admin");
    revalidatePath("/queue");
  });
}

export async function setTodayModeAction(mode: TodayMode) {
  return runAction("settings.setTodayMode", "user", async () => {
    await setTodayMode(mode === "clients" ? "clients" : "jobs");
    revalidatePath("/");
  });
}
