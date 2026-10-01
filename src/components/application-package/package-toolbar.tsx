"use client";

import Link from "next/link";
import { Check, Eye, Copy, Download, MoreHorizontal, Printer, RefreshCw, Save } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { PackageEditor } from "./use-package-editor";

export type Tab = "cv" | "letter" | "email";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "cv", label: "CV" },
  { id: "letter", label: "Letter" },
  { id: "email", label: "Email" },
];

/** Section tabs, the one primary next step, and the rest of the package actions. */
export function PackageToolbar({
  editor,
  tab,
  setTab,
  pending,
  canEmail,
  mailboxConnected,
  hasPreview,
  onOpenPreview,
  onOpenSend,
  showEvidence,
  setShowEvidence,
}: {
  editor: PackageEditor;
  tab: Tab;
  setTab: (tab: Tab) => void;
  pending: boolean;
  canEmail: boolean;
  mailboxConnected: boolean;
  hasPreview: boolean;
  onOpenPreview: () => void;
  onOpenSend: () => void;
  showEvidence: boolean;
  setShowEvidence: (show: boolean | ((current: boolean) => boolean)) => void;
}) {
  const {
    pkg, letter, email, dirty, emailDirty, alreadySent, saveAll, approve, markPrepared, exportText,
    copyLetter, copyEmail, regenerateSummary, regenerateLetter, generate,
  } = editor;
  if (!pkg) return null;

  const canSend =
    !dirty &&
    !emailDirty &&
    mailboxConnected &&
    (pkg.state === "approved" || pkg.state === "prepared") &&
    !alreadySent;

  const primary = (() => {
    if (dirty || emailDirty) {
      return { id: "save" as const, label: pending ? "Saving…" : "Save", icon: Save };
    }
    if (pkg.state === "draft") {
      return { id: "approve" as const, label: pending ? "Approving…" : "Approve", icon: Check };
    }
    if (!alreadySent && (pkg.state === "approved" || pkg.state === "prepared")) {
      return canEmail
        ? { id: "send" as const, label: "Send", icon: Check }
        : { id: "download" as const, label: "Download", icon: Download };
    }
    return null;
  })();

  const runPrimary = () => {
    if (!primary) return;
    if (primary.id === "save") saveAll();
    else if (primary.id === "approve") approve();
    else if (primary.id === "send") onOpenSend();
    else if (primary.id === "download") exportText();
  };

  const printPreview = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SegmentedControl
        options={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Package sections"
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasPreview ? (
          <Button
            size="sm"
            variant="outline"
            className="xl:hidden"
            onClick={onOpenPreview}
          >
            <Eye className="size-3.5" />
            Preview
          </Button>
        ) : null}
        {alreadySent ? (
          <Link
            href="/queue?tab=applications"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View in Queue
          </Link>
        ) : null}
        {primary ? (
          <Button
            size="sm"
            disabled={
              pending ||
              (primary.id === "approve" && (dirty || emailDirty)) ||
              (primary.id === "send" && !canSend)
            }
            onClick={runPrimary}
          >
            <primary.icon className="size-3.5" />
            {primary.label}
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="outline"
                disabled={pending}
                aria-label="More actions"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {(dirty || emailDirty) && !alreadySent ? (
              <DropdownMenuItem disabled={pending} onClick={saveAll}>
                <Save className="size-4" />
                Save
              </DropdownMenuItem>
            ) : null}
            {pkg.state === "approved" && !alreadySent ? (
              <DropdownMenuItem disabled={pending} onClick={markPrepared}>
                <Check className="size-4" />
                Mark prepared
              </DropdownMenuItem>
            ) : null}
            {primary?.id !== "download" ? (
              <DropdownMenuItem disabled={pending} onClick={exportText}>
                <Download className="size-4" />
                Export .txt
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              disabled={!letter}
              onClick={() => void copyLetter()}
            >
              <Copy className="size-4" />
              Copy letter
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!email}
              onClick={() => void copyEmail()}
            >
              <Copy className="size-4" />
              Copy email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={printPreview}>
              <Printer className="size-4" />
              Print preview
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowEvidence((v) => !v)}
            >
              {showEvidence ? "Hide evidence" : "Show evidence"}
            </DropdownMenuItem>
            {tab === "cv" ? (
              <DropdownMenuItem
                disabled={pending || alreadySent}
                onClick={regenerateSummary}
              >
                <RefreshCw className="size-4" />
                Regenerate summary
              </DropdownMenuItem>
            ) : null}
            {tab === "letter" || tab === "email" ? (
              <DropdownMenuItem
                disabled={pending || alreadySent}
                onClick={regenerateLetter}
              >
                <RefreshCw className="size-4" />
                Regenerate letter
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              disabled={pending || alreadySent}
              onClick={generate}
            >
              <RefreshCw className="size-4" />
              Regenerate all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
