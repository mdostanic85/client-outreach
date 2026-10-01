import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Contract for who may call each Server Action. Client outreach, the shared
 * mailbox, API keys, privacy tools and admin are owner-only; job search,
 * profile and application drafting belong to every account.
 * Changing an entry here is a security decision, not a refactor.
 */
const OWNER_ONLY = new Set([
  // leads + discovery + research
  "researchLeadAction", "acceptLeadAction", "rejectLeadAction", "saveForLaterAction",
  "markRepliedAction", "setFollowUpAction", "suppressLeadAction", "setLeadStateAction",
  "runVerticalSliceAction", "submitManualCompanyAction",
  // contacts + outreach drafts
  "addContactAction", "confirmContactAction", "harvestContactsAction", "suggestPatternsAction",
  "checkMxAction", "generateDraftAction", "inspectDraftQualityAction", "saveDraftAction",
  "markSentAction",
  // shared mailbox
  "approveDraftAction", "processSendQueueAction", "syncMailboxAction", "resumeMailboxAction",
  "saveGoogleOauthClientAction", "saveOtherMailboxAction", "disconnectMailboxAction",
  "sendApplicationPackageAction",
  // client-outreach learning
  "saveSourceReportAction", "proposeStyleAction", "proposeScoringAction",
  "generateMarketReportAction", "generatePositioningAction",
  // workspace settings, admin, privacy
  "updateSettingsAction", "runDailyPipelineAction", "updateOpsChecklistAction",
  "saveSecretAction", "clearSecretAction", "exportPersonalDataAction", "deleteContactAction",
  "runRetentionPruneAction",
]);

const modulesDir = path.join(import.meta.dirname, "../src/modules");

function actionFiles(): string[] {
  return readdirSync(modulesDir)
    .map((dir) => path.join(modulesDir, dir, "actions.ts"))
    .filter((file) => existsSync(file))
    .filter((file) => readFileSync(file, "utf8").startsWith('"use server"'))
    // auth and onboarding run before or without a full session; they check it themselves.
    .filter((file) => !/modules\/(auth|onboarding)\//.test(file));
}

function declaredAccess(): Map<string, string> {
  const access = new Map<string, string>();
  for (const file of actionFiles()) {
    const source = readFileSync(file, "utf8");
    const blocks = source.split(/^export async function /m).slice(1);
    for (const block of blocks) {
      const name = block.match(/^(\w+)/)![1]!;
      const level = block.match(/runAction\(\s*"[^"]+",\s*"(owner|user)"/)?.[1];
      access.set(name, level ?? "missing");
    }
  }
  return access;
}

test("every domain Server Action goes through runAction with an access level", () => {
  const missing = [...declaredAccess()].filter(([, level]) => level === "missing");
  assert.deepEqual(missing, []);
});

test("owner-only actions stay owner-only and nothing else is", () => {
  const access = declaredAccess();
  for (const name of OWNER_ONLY) {
    assert.equal(access.get(name), "owner", `${name} must require the workspace owner`);
  }
  const extraOwner = [...access].filter(([name, level]) => level === "owner" && !OWNER_ONLY.has(name));
  assert.deepEqual(extraOwner, [], "new owner-only actions must be listed in OWNER_ONLY");
});
