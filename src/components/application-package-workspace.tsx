"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  Eye,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Save,
} from "lucide-react";
import {
  approvePackageAction,
  exportPackageTextAction,
  generateApplicationPackageAction,
  markPackagePreparedAction,
  regeneratePackageSlotAction,
  savePackageCvAction,
  savePackageEmailAction,
  savePackageLetterAction,
} from "@/app/actions";
import { ApplicationSendModal } from "@/components/application-send-modal";
import { CoverLetterPreview } from "@/components/cover-letter-preview";
import { CvDocumentPreview } from "@/components/cv-document-preview";
import { InlineAlert } from "@/components/inline-alert";
import {
  ApplicationEmailPreview,
  PackageEmailEditor,
} from "@/components/package-email-editor";
import { PackageEvidencePanel } from "@/components/package-evidence-panel";
import {
  PackageCvSlotEditor,
  PackageLetterSlotEditor,
} from "@/components/package-slot-editor";
import { PageHeader, PageShell, Surface } from "@/components/page-shell";
import { SegmentedControl } from "@/components/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  applicationEmailToPlainText,
  buildApplicationEmail,
  type ApplicationEmailDraft,
} from "@/modules/applications/application-email";
import type { ApplicationPackageView } from "@/modules/applications/packages";
import type {
  CoverLetter,
  PackageMarket,
  TailoredCv,
} from "@/modules/applications/schemas";
import { coverLetterToPlainText } from "@/modules/applications/schemas";

type Tab = "cv" | "letter" | "email";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "cv", label: "CV" },
  { id: "letter", label: "Letter" },
  { id: "email", label: "Email" },
];

function stateLabel(state: string) {
  if (state === "prepared") return "Prepared";
  if (state === "approved") return "Approved";
  if (state === "draft") return "Draft";
  return state;
}

export function ApplicationPackageWorkspace({
  jobId,
  jobTitle,
  companyName,
  sourceUrl,
  suggestedMarket,
  initialPackage,
  hasApprovedProfile,
  mailboxConnected,
  canEmail = true,
  mailboxEmail,
  openSendOnMount = false,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  sourceUrl: string;
  suggestedMarket: PackageMarket;
  initialPackage: ApplicationPackageView | null;
  hasApprovedProfile: boolean;
  mailboxConnected: boolean;
  /** Sending from the app uses the owner's mailbox; everyone else downloads and applies. */
  canEmail?: boolean;
  mailboxEmail: string | null;
  openSendOnMount?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("cv");
  const [showEvidence, setShowEvidence] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(openSendOnMount);
  const [market, setMarket] = useState<PackageMarket>(
    initialPackage?.marketLabel ?? suggestedMarket,
  );
  const [pkg, setPkg] = useState(initialPackage);
  const [cv, setCv] = useState<TailoredCv | null>(initialPackage?.cv ?? null);
  const [letter, setLetter] = useState<CoverLetter | null>(
    initialPackage?.letter ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [email, setEmail] = useState<ApplicationEmailDraft | null>(
    initialPackage?.email ?? null,
  );

  useEffect(() => {
    setPkg(initialPackage);
    setCv(initialPackage?.cv ?? null);
    setLetter(initialPackage?.letter ?? null);
    if (initialPackage) setMarket(initialPackage.marketLabel);
    setDirty(false);
    if (initialPackage?.email) {
      setEmail(initialPackage.email);
      setEmailDirty(false);
    } else if (initialPackage?.cv && initialPackage.letter) {
      setEmail(
        buildApplicationEmail({
          letter: initialPackage.letter,
          cv: initialPackage.cv,
          jobTitle,
          companyName,
        }),
      );
      setEmailDirty(false);
    } else {
      setEmail(null);
      setEmailDirty(false);
    }
  }, [initialPackage, jobTitle, companyName]);

  useEffect(() => {
    if (openSendOnMount) setSendOpen(true);
  }, [openSendOnMount]);

  // Keep email body in sync with letter until the user edits email independently.
  useEffect(() => {
    if (!letter || !cv || emailDirty) return;
    setEmail((prev) =>
      buildApplicationEmail({
        letter,
        cv,
        jobTitle,
        companyName,
        to: prev?.to,
      }),
    );
  }, [letter, cv, jobTitle, companyName, emailDirty]);

  const alreadySent =
    pkg?.mailStatus === "sent" ||
    pkg?.mailStatus === "waiting" ||
    pkg?.mailStatus === "follow_up";

  const canSend =
    Boolean(pkg) &&
    !dirty &&
    !emailDirty &&
    mailboxConnected &&
    (pkg?.state === "approved" || pkg?.state === "prepared") &&
    !alreadySent;

  const primary = useMemo(() => {
    if (!pkg) return null;
    if (dirty || emailDirty) {
      return {
        id: "save" as const,
        label: pending ? "Saving…" : "Save",
        icon: Save,
      };
    }
    if (pkg.state === "draft") {
      return {
        id: "approve" as const,
        label: pending ? "Approving…" : "Approve",
        icon: Check,
      };
    }
    if (!alreadySent && (pkg.state === "approved" || pkg.state === "prepared")) {
      return canEmail
        ? { id: "send" as const, label: "Send", icon: Check }
        : { id: "download" as const, label: "Download", icon: Download };
    }
    return null;
  }, [pkg, dirty, emailDirty, pending, alreadySent, canEmail]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else router.refresh();
    });
  };

  const generate = () => {
    if (!hasApprovedProfile) {
      setError("Approve your professional profile first.");
      return;
    }
    run(async () => {
      const res = await generateApplicationPackageAction({
        jobId,
        market,
        marketConfirmed: true,
      });
      if (res.ok) {
        setInfo(
          "Package generated. Review CV, letter, and email before approving.",
        );
        router.push(`/interested/${jobId}/package`);
        router.refresh();
      }
      return res;
    });
  };

  const saveAll = () => {
    if (!pkg || !cv || !letter) return;
    run(async () => {
      const cvRes = await savePackageCvAction({ packageId: pkg.id, cv });
      if (!cvRes.ok) return cvRes;
      const letterRes = await savePackageLetterAction({
        packageId: pkg.id,
        letter,
      });
      if (!letterRes.ok) return letterRes;
      if (email) {
        const emailRes = await savePackageEmailAction({
          packageId: pkg.id,
          email,
        });
        if (!emailRes.ok) return emailRes;
      }
      setDirty(false);
      setEmailDirty(false);
      setInfo(
        pkg.state === "draft"
          ? "Saved."
          : "Saved. Approval cleared — approve again when ready.",
      );
      setPkg((p) =>
        p
          ? {
              ...p,
              cv,
              letter,
              email: email ?? p.email,
              state:
                p.state === "prepared" || p.state === "approved"
                  ? "draft"
                  : p.state,
              contentHash: null,
              approvedAt: null,
            }
          : p,
      );
      return { ok: true as const };
    });
  };

  const approve = () => {
    if (!pkg) return;
    run(async () => {
      if (email) {
        const emailRes = await savePackageEmailAction({
          packageId: pkg.id,
          email,
        });
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
  };

  const markPrepared = () => {
    if (!pkg) return;
    run(async () => {
      const res = await markPackagePreparedAction(pkg.id);
      if (res.ok) {
        setPkg((p) => (p ? { ...p, state: "prepared" } : p));
        setInfo("Marked prepared.");
      }
      return res;
    });
  };

  const exportText = () => {
    if (!pkg) return;
    run(async () => {
      const res = await exportPackageTextAction(pkg.id);
      if (!res.ok) return res;
      const blob = new Blob([res.data.text], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setInfo("Plain-text package downloaded.");
      return { ok: true as const };
    });
  };

  const copyLetter = async () => {
    if (!letter) return;
    await navigator.clipboard.writeText(coverLetterToPlainText(letter));
    setInfo("Cover letter copied.");
  };

  const copyEmail = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(applicationEmailToPlainText(email));
    setInfo("Application email copied.");
  };

  const printPreview = () => {
    window.print();
  };

  const runPrimary = () => {
    if (!primary) return;
    if (primary.id === "save") saveAll();
    else if (primary.id === "approve") approve();
    else if (primary.id === "send") setSendOpen(true);
    else if (primary.id === "download") exportText();
  };

  const regenerateSummary = () => {
    if (!pkg || !cv) return;
    run(async () => {
      if (dirty) {
        await savePackageCvAction({ packageId: pkg.id, cv });
        setDirty(false);
      }
      const res = await regeneratePackageSlotAction({
        packageId: pkg.id,
        slot: "summary",
      });
      if (res.ok) {
        setInfo("Summary regenerated.");
        router.refresh();
      }
      return res;
    });
  };

  const regenerateLetter = () => {
    if (!pkg || !letter) return;
    run(async () => {
      if (dirty && cv) {
        await savePackageCvAction({ packageId: pkg.id, cv });
        await savePackageLetterAction({ packageId: pkg.id, letter });
        setDirty(false);
      }
      const res = await regeneratePackageSlotAction({
        packageId: pkg.id,
        slot: "letter",
      });
      if (res.ok) {
        setInfo("Cover letter regenerated.");
        setEmailDirty(false);
        router.refresh();
      }
      return res;
    });
  };

  const previewNode = (() => {
    if (tab === "letter" && letter) {
      return (
        <CoverLetterPreview
          letter={letter}
          cv={cv}
          companyName={companyName}
          jobTitle={jobTitle}
        />
      );
    }
    if (tab === "email" && email) {
      return (
        <ApplicationEmailPreview
          email={email}
          fromName={cv?.fullName || letter?.fullName || ""}
          fromEmail={cv?.email}
        />
      );
    }
    if (cv) {
      return (
        <CvDocumentPreview cv={cv} market={pkg?.marketLabel ?? market} />
      );
    }
    return null;
  })();

  return (
    <PageShell>
      <PageHeader
        title="Application package"
        description={`${jobTitle} · ${companyName}`}
          meta={
          pkg ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{stateLabel(pkg.state)}</Badge>
              {alreadySent ? (
                <Badge variant="outline">Sent</Badge>
              ) : null}
              {dirty || emailDirty ? (
                <Badge variant="outline">Unsaved</Badge>
              ) : null}
            </div>
          ) : (
            "Not generated"
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/jobs/${jobId}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
              )}
            >
              Back to job
            </Link>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Posting
              <ExternalLink className="size-3.5 opacity-70" />
            </a>
          </div>
        }
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {info ? <InlineAlert variant="success">{info}</InlineAlert> : null}

      {!hasApprovedProfile ? (
        <Surface className="p-6">
          <InlineAlert variant="error">
            Approve a professional profile before generating a package.{" "}
            <Link href="/profile" className="underline">
              Go to Profile
            </Link>
          </InlineAlert>
        </Surface>
      ) : null}

      {!pkg ? (
        <Surface className="p-6 sm:p-8">
          <div className="mx-auto max-w-lg space-y-6">
            <div className="space-y-2">
              <h2 className="text-h5 font-medium">
                Prepare this application
              </h2>
              <p className="text-muted-foreground text-body leading-relaxed">
                Generate a tailored one-page CV and cover letter from your
                approved profile. Market sets US Resume vs Europe CV wording —
                layout stays ATS-safe either way.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="package-market">Market</Label>
              <Select
                value={market}
                onValueChange={(value) => {
                  if (value === "us" || value === "europe") setMarket(value);
                }}
                disabled={pending}
                items={{
                  europe: "Europe (CV)",
                  us: "United States (Resume)",
                }}
              >
                <SelectTrigger id="package-market" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} align="start">
                  <SelectItem value="europe">Europe (CV)</SelectItem>
                  <SelectItem value="us">United States (Resume)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={pending || !hasApprovedProfile}
              onClick={generate}
              className="w-full sm:w-auto"
            >
              {pending ? "Generating…" : "Generate package"}
            </Button>
          </div>
        </Surface>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              options={TABS}
              value={tab}
              onChange={setTab}
              ariaLabel="Package sections"
            />

            <div className="flex flex-wrap items-center justify-end gap-2">
              {previewNode ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="xl:hidden"
                  onClick={() => setPreviewOpen(true)}
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

          <HowToApplyPanel pkg={pkg} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <Surface className="xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto">
              <div className="p-5 sm:p-6">
                {tab === "letter" && pkg.letterOptional ? (
                  <p className="text-ink-emphasis bg-subtle mb-5 rounded-tile px-4 py-3 text-body-sm">
                    Employers in your field rarely ask for a cover letter, and this posting doesn&apos;t. You can skip it and apply with your CV.
                  </p>
                ) : null}
                {tab === "cv" && cv ? (
                  <PackageCvSlotEditor
                    cv={cv}
                    market={pkg.marketLabel}
                    pending={pending || alreadySent}
                    onChange={(next) => {
                      setCv(next);
                      setDirty(true);
                    }}
                    onRegenerateSummary={regenerateSummary}
                  />
                ) : null}
                {tab === "letter" && letter ? (
                  <PackageLetterSlotEditor
                    letter={letter}
                    pending={pending || alreadySent}
                    onChange={(next) => {
                      setLetter(next);
                      setDirty(true);
                    }}
                    onRegenerate={regenerateLetter}
                  />
                ) : null}
                {tab === "email" && email ? (
                  <PackageEmailEditor
                    email={email}
                    pending={pending || alreadySent}
                    fromName={cv?.fullName || letter?.fullName || ""}
                    fromEmail={mailboxEmail ?? cv?.email}
                    companyName={companyName}
                    onChange={(next) => {
                      setEmail(next);
                      setEmailDirty(true);
                    }}
                  />
                ) : null}
                {showEvidence ? (
                  <div className="mt-6 border-t border-[var(--border)] pt-6">
                    <PackageEvidencePanel
                      analysis={pkg.analysis}
                      grounding={pkg.grounding}
                      warnings={pkg.warnings}
                    />
                  </div>
                ) : null}
              </div>
            </Surface>

            <div className="app-doc-preview-stage hidden rounded-card p-4 xl:block xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto print:block">
              <div className="app-doc-print-root">{previewNode}</div>
            </div>
          </div>

          {/* Below xl the live preview opens in a sheet instead of stacking under the editor. */}
          <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
            <SheetContent side="right" className="gap-0 p-0 data-[side=right]:sm:max-w-3xl">
              <SheetHeader>
                <SheetTitle>
                  {tab === "cv" ? "CV preview" : tab === "letter" ? "Cover letter preview" : "Email preview"}
                </SheetTitle>
              </SheetHeader>
              <div className="app-doc-preview-stage min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                {previewNode}
              </div>
            </SheetContent>
          </Sheet>

          {pkg && email ? (
            <ApplicationSendModal
              open={sendOpen}
              onOpenChange={setSendOpen}
              packageId={pkg.id}
              companyName={companyName}
              jobTitle={jobTitle}
              fromEmail={mailboxEmail}
              initialEmail={email}
              mailboxConnected={mailboxConnected}
            />
          ) : null}
        </>
      )}
    </PageShell>
  );
}

/** Email / phone / link from the posting: many local jobs are applied to directly. */
function HowToApplyPanel({ pkg }: { pkg: ApplicationPackageView }) {
  const { emails, phones, links } = pkg.howToApply;
  if (!emails.length && !phones.length && !links.length) return null;
  return (
    <Surface>
      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
        <p className="text-body font-medium text-foreground">
          How to apply
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm">
          {emails.map((email) => (
            <li key={email}>
              <a className="text-brand-ink hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </li>
          ))}
          {phones.map((phone) => (
            <li key={phone}>
              <a className="text-brand-ink hover:underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                {phone}
              </a>
            </li>
          ))}
          {links.map((link) => (
            <li key={link} className="max-w-full truncate">
              <a className="text-brand-ink hover:underline" href={link} target="_blank" rel="noreferrer">
                Application form
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Surface>
  );
}
