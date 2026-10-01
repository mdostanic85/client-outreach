"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ActionRunner } from "@/components/use-action-runner";
import {
  approvePackageAction,
  exportPackageTextAction,
  generateApplicationPackageAction,
  markPackagePreparedAction,
  regeneratePackageSlotAction,
  savePackageCvAction,
  savePackageEmailAction,
  savePackageLetterAction,
} from "@/modules/applications/actions";
import {
  applicationEmailToPlainText,
  buildApplicationEmail,
  type ApplicationEmailDraft,
} from "@/modules/applications/application-email";
import type { ApplicationPackageView } from "@/modules/applications/packages";
import {
  coverLetterToPlainText,
  type CoverLetter,
  type PackageMarket,
  type TailoredCv,
} from "@/modules/applications/schemas";

/**
 * Local copy of an application package while the user edits it: CV, letter
 * and email edits, the package state, and every action on it. Edits reset
 * whenever the server sends a newer package.
 *
 * The email follows the letter (keeping the recipient) until the user edits
 * the email itself.
 */
export function usePackageEditor({
  jobId,
  jobTitle,
  companyName,
  suggestedMarket,
  initialPackage,
  hasApprovedProfile,
  canEmail,
  runner,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  suggestedMarket: PackageMarket;
  initialPackage: ApplicationPackageView | null;
  hasApprovedProfile: boolean;
  canEmail: boolean;
  runner: ActionRunner;
}) {
  const router = useRouter();
  const { run, setError, setMessage: setInfo } = runner;

  const [market, setMarket] = useState<PackageMarket>(
    initialPackage?.marketLabel ?? suggestedMarket,
  );
  const [pkg, setPkg] = useState(initialPackage);
  const [cv, setCv] = useState<TailoredCv | null>(initialPackage?.cv ?? null);
  const [letter, setLetter] = useState<CoverLetter | null>(initialPackage?.letter ?? null);
  const [dirty, setDirty] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [emailDraft, setEmailDraft] = useState<ApplicationEmailDraft | null>(
    initialPackage?.email ?? null,
  );

  // A new package from the server replaces local edits.
  const [syncedPackage, setSyncedPackage] = useState(initialPackage);
  if (initialPackage !== syncedPackage) {
    setSyncedPackage(initialPackage);
    setPkg(initialPackage);
    setCv(initialPackage?.cv ?? null);
    setLetter(initialPackage?.letter ?? null);
    if (initialPackage) setMarket(initialPackage.marketLabel);
    setDirty(false);
    setEmailDirty(false);
    setEmailDraft(initialPackage?.email ?? null);
  }

  // Memoised so the send sheet only resets when the email really changes.
  const email = useMemo<ApplicationEmailDraft | null>(
    () =>
      !emailDirty && letter && cv
        ? buildApplicationEmail({ letter, cv, jobTitle, companyName, to: emailDraft?.to })
        : emailDraft,
    [emailDirty, letter, cv, jobTitle, companyName, emailDraft],
  );

  const alreadySent =
    pkg?.mailStatus === "sent" ||
    pkg?.mailStatus === "waiting" ||
    pkg?.mailStatus === "follow_up";
  const unsaved = dirty || emailDirty;

  function editCv(next: TailoredCv) {
    setCv(next);
    setDirty(true);
  }

  function editLetter(next: CoverLetter) {
    setLetter(next);
    setDirty(true);
  }

  function editEmail(next: ApplicationEmailDraft) {
    setEmailDraft(next);
    setEmailDirty(true);
  }

  function generate() {
    if (!hasApprovedProfile) {
      setError("Approve your professional profile first.");
      return;
    }
    run(
      async () => {
        const res = await generateApplicationPackageAction({
          jobId,
          market,
          marketConfirmed: true,
        });
        if (res.ok) {
          setInfo("Package generated. Review CV, letter, and email before approving.");
        }
        return res;
      },
      { onSuccess: () => router.push(`/interested/${jobId}/package`) },
    );
  }

  function saveAll() {
    if (!pkg || !cv || !letter) return;
    run(async () => {
      const cvRes = await savePackageCvAction({ packageId: pkg.id, cv });
      if (!cvRes.ok) return cvRes;
      const letterRes = await savePackageLetterAction({ packageId: pkg.id, letter });
      if (!letterRes.ok) return letterRes;
      if (email) {
        const emailRes = await savePackageEmailAction({ packageId: pkg.id, email });
        if (!emailRes.ok) return emailRes;
      }
      setDirty(false);
      setEmailDirty(false);
      setInfo(
        pkg.state === "draft"
          ? "Saved."
          : "Saved. Approval cleared — approve again when ready.",
      );
      // Saving an approved package sends it back to draft on the server too.
      setPkg((p) =>
        p
          ? {
              ...p,
              cv,
              letter,
              email: email ?? p.email,
              state: p.state === "prepared" || p.state === "approved" ? "draft" : p.state,
              contentHash: null,
              approvedAt: null,
            }
          : p,
      );
      return { ok: true as const };
    });
  }

  function approve() {
    if (!pkg) return;
    run(async () => {
      if (email) {
        const emailRes = await savePackageEmailAction({ packageId: pkg.id, email });
        if (!emailRes.ok) return emailRes;
      }
      const res = await approvePackageAction(pkg.id);
      if (res.ok) {
        setPkg((p) => (p ? { ...p, state: "approved" } : p));
        setInfo(
          canEmail
            ? "Approved — ready to Send."
            : "Approved. Download it and apply on the company's site.",
        );
        setEmailDirty(false);
      }
      return res;
    });
  }

  function markPrepared() {
    if (!pkg) return;
    run(async () => {
      const res = await markPackagePreparedAction(pkg.id);
      if (res.ok) {
        setPkg((p) => (p ? { ...p, state: "prepared" } : p));
        setInfo("Marked prepared.");
      }
      return res;
    });
  }

  function exportText() {
    if (!pkg) return;
    run(async () => {
      const res = await exportPackageTextAction(pkg.id);
      if (!res.ok) return res;
      const blob = new Blob([res.data.text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setInfo("Plain-text package downloaded.");
      return { ok: true as const };
    });
  }

  async function copyLetter() {
    if (!letter) return;
    await navigator.clipboard.writeText(coverLetterToPlainText(letter));
    setInfo("Cover letter copied.");
  }

  async function copyEmail() {
    if (!email) return;
    await navigator.clipboard.writeText(applicationEmailToPlainText(email));
    setInfo("Application email copied.");
  }

  /** Unsaved CV edits are saved first, so regeneration starts from them. */
  function regenerateSummary() {
    if (!pkg || !cv) return;
    run(async () => {
      if (dirty) {
        const saved = await savePackageCvAction({ packageId: pkg.id, cv });
        if (!saved.ok) return saved;
        setDirty(false);
      }
      const res = await regeneratePackageSlotAction({ packageId: pkg.id, slot: "summary" });
      if (res.ok) setInfo("Summary regenerated.");
      return res;
    });
  }

  function regenerateLetter() {
    if (!pkg || !letter) return;
    run(async () => {
      if (dirty && cv) {
        const savedCv = await savePackageCvAction({ packageId: pkg.id, cv });
        if (!savedCv.ok) return savedCv;
        const savedLetter = await savePackageLetterAction({ packageId: pkg.id, letter });
        if (!savedLetter.ok) return savedLetter;
        setDirty(false);
      }
      const res = await regeneratePackageSlotAction({ packageId: pkg.id, slot: "letter" });
      if (res.ok) {
        setInfo("Cover letter regenerated.");
        setEmailDirty(false);
      }
      return res;
    });
  }

  return {
    market,
    setMarket,
    pkg,
    cv,
    letter,
    email,
    dirty,
    emailDirty,
    unsaved,
    alreadySent,
    editCv,
    editLetter,
    editEmail,
    generate,
    saveAll,
    approve,
    markPrepared,
    exportText,
    copyLetter,
    copyEmail,
    regenerateSummary,
    regenerateLetter,
  };
}

export type PackageEditor = ReturnType<typeof usePackageEditor>;
