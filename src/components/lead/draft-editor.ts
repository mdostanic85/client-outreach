"use client";

import { useState } from "react";
import type { LeadDraft } from "./lead-stage";

/**
 * Local edits to the lead's latest draft, shared by Compose, Approve and the
 * unsaved-changes bar. Edits reset whenever the server draft changes.
 */
export function useDraftEditor(draft: LeadDraft | undefined) {
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.bodyFinal ?? "");
  const [qualityIssues, setQualityIssues] = useState<Array<{ code: string; message: string }>>([]);

  const draftKey = draft ? `${draft.id}|${draft.subject}|${draft.bodyFinal}` : null;
  const [syncedKey, setSyncedKey] = useState(draftKey);
  if (draft && draftKey !== syncedKey) {
    setSyncedKey(draftKey);
    setSubject(draft.subject);
    setBody(draft.bodyFinal);
  }

  const dirty =
    !!draft &&
    draft.state !== "sent" &&
    (subject !== draft.subject || body !== draft.bodyFinal);

  return { subject, setSubject, body, setBody, qualityIssues, setQualityIssues, dirty };
}

export type DraftEditor = ReturnType<typeof useDraftEditor>;
