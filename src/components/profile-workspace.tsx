"use client";

import { useEffect, useState } from "react";
import { InlineAlert } from "@/components/inline-alert";
import { Surface } from "@/components/page-shell";
import {
  ProfileDraftEditor,
  reviewTabFromFix,
  type ProfileFixTarget,
  type ReviewTab,
} from "@/components/profile/profile-draft-editor";
import { ProfileSources, type SourceView } from "@/components/profile/profile-sources";
import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import { StickyFormActions } from "@/components/sticky-form-actions";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";
import {
  approveProfileAction,
  createProfileDraftFromApprovedAction,
  extractProfileAction,
  saveProfileDraftAction,
} from "@/modules/profile/actions";
import type { MatchingSourcesConfig } from "@/modules/profile/matching-sources-core";
import {
  formValuesToProfile,
  profileToFormValues,
  type ProfileFormValues,
} from "@/modules/profile/profile-form";
import { EMPTY_STRUCTURED_PROFILE, type StructuredProfile } from "@/modules/profile/schemas";

export type { ProfileFixTarget };

type ProfileView = {
  id: string;
  version: number;
  status: string;
  modelId: string | null;
  promptVersion: string | null;
  createdAt: string;
  approvedAt: string | null;
  profile: StructuredProfile;
  sourceIds: string[];
};

/**
 * Local edits to the draft profile. Resets when a different draft (or
 * version) arrives from the server.
 */
function useProfileForm(draft: ProfileView | null, approved: ProfileView | null) {
  const editable: StructuredProfile =
    draft?.profile ?? approved?.profile ?? EMPTY_STRUCTURED_PROFILE;
  const [values, setValues] = useState<ProfileFormValues>(() => profileToFormValues(editable));
  const [editingId, setEditingId] = useState<string | null>(draft?.id ?? null);

  const formKey = `${draft?.id ?? "none"}-${draft?.version ?? 0}-${approved?.id ?? "none"}`;
  const [lastKey, setLastKey] = useState(formKey);
  if (formKey !== lastKey) {
    setLastKey(formKey);
    setEditingId(draft?.id ?? null);
    setValues(profileToFormValues(editable));
  }

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return { values, set, editingId, build: () => formValuesToProfile(values, editable) };
}

/**
 * Profile page: the approved profile (or the draft under review), its
 * sources, and the save / approve bar. Matching only reads approved versions.
 */
export function ProfileWorkspace({
  sources,
  matchingConfig,
  draft,
  approved,
  initialFix = null,
  children,
}: {
  sources: SourceView[];
  matchingConfig: MatchingSourcesConfig;
  draft: ProfileView | null;
  approved: ProfileView | null;
  /** Market fit deep-link (`?fix=`). */
  initialFix?: ProfileFixTarget | null;
  /** Extra setup sections (e.g. Matching) — rendered above sticky approve. */
  children?: React.ReactNode;
}) {
  const runner = useActionRunner();
  const { pending, error, message, setError, run: runWith } = runner;
  const run = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    runWith(fn, { success: label });

  // `?fix=` deep links from "Worth improving" open the right place on first render.
  const [reviewTab, setReviewTab] = useState<ReviewTab>(
    () => reviewTabFromFix(initialFix) ?? "essentials",
  );
  useEffect(() => {
    if (!initialFix) return;
    requestAnimationFrame(() => {
      document
        .getElementById("profile-workspace")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [initialFix]);

  const active = draft ?? approved;
  const canEdit = Boolean(draft) && !pending;
  const form = useProfileForm(draft, approved);

  /** Reads the form, or shows why it can't be saved. */
  function readForm(): StructuredProfile | null {
    try {
      return form.build();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  function saveDraft() {
    if (!draft) return;
    const profile = readForm();
    if (!profile) return;
    run("Saved", () => saveProfileDraftAction(form.editingId ?? draft.id, profile));
  }

  function approveDraft() {
    if (!draft) return;
    const profile = readForm();
    if (!profile) return;
    const id = form.editingId ?? draft.id;
    runWith(
      async () => {
        const saved = await saveProfileDraftAction(id, profile);
        if (!saved.ok) return saved;
        return approveProfileAction(id);
      },
      { success: "Approved for job matching" },
    );
  }

  const editButton = (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        run("Ready to edit", () => createProfileDraftFromApprovedAction())
      }
    >
      {pending ? "Opening…" : "Edit"}
    </Button>
  );

  return (
    <div id="profile-workspace" className="space-y-6 scroll-mt-20">
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {message ? <InlineAlert variant="info">{message}</InlineAlert> : null}

      {!active ? (
        <Surface>
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center sm:px-8 sm:py-14">
            <p className="font-heading text-h5 font-medium">No profile yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-body leading-relaxed">
              {sources.length === 0
                ? "Add your CV below. Optra reads it and builds your profile."
                : "Build your profile from the sources you added."}
            </p>
            {sources.length > 0 ? (
              <Button
                type="button"
                size="lg"
                className="min-w-[12rem]"
                disabled={pending}
                onClick={() => run("Profile drafted", () => extractProfileAction())}
              >
                {pending ? "Building…" : "Build my profile"}
              </Button>
            ) : null}
          </div>
        </Surface>
      ) : draft ? (
        <ProfileDraftEditor
          values={form.values}
          set={form.set}
          canEdit={canEdit}
          reviewTab={reviewTab}
          setReviewTab={setReviewTab}
        />
      ) : (
        <ProfileSummaryCard profile={active.profile} action={editButton} />
      )}

      <ProfileSources
        sources={sources}
        matchingConfig={matchingConfig}
        hasProfile={Boolean(active)}
        initiallyOpen={initialFix === "sources"}
        runner={runner}
      >
        {children}
      </ProfileSources>

      {draft ? (
        <StickyFormActions message="Matching keeps using your approved profile until you approve this one.">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={saveDraft}
          >
            Save draft
          </Button>
          <Button type="button" size="lg" disabled={pending} onClick={approveDraft}>
            Approve profile
          </Button>
        </StickyFormActions>
      ) : null}
    </div>
  );
}
