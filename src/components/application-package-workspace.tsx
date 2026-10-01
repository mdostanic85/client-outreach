"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { HowToApplyPanel } from "@/components/application-package/how-to-apply-panel";
import { PackageGenerateCard } from "@/components/application-package/package-generate-card";
import { PackageToolbar, type Tab } from "@/components/application-package/package-toolbar";
import { usePackageEditor } from "@/components/application-package/use-package-editor";
import { ApplicationSendModal } from "@/components/application-send-modal";
import { CoverLetterPreview } from "@/components/cover-letter-preview";
import { CvDocumentPreview } from "@/components/cv-document-preview";
import { InlineAlert } from "@/components/inline-alert";
import { ApplicationEmailPreview, PackageEmailEditor } from "@/components/package-email-editor";
import { PackageEvidencePanel } from "@/components/package-evidence-panel";
import { PackageCvSlotEditor, PackageLetterSlotEditor } from "@/components/package-slot-editor";
import { PageHeader, PageShell, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useActionRunner } from "@/components/use-action-runner";
import { cn } from "@/lib/utils";
import type { ApplicationPackageView } from "@/modules/applications/packages";
import type { PackageMarket } from "@/modules/applications/schemas";

function stateLabel(state: string) {
  if (state === "prepared") return "Prepared";
  if (state === "approved") return "Approved";
  if (state === "draft") return "Draft";
  return state;
}

/**
 * Tailored CV, cover letter and application email for one saved job: edit,
 * approve, then send or download. Package state and actions live in
 * `usePackageEditor`; this component lays out the editor and the preview.
 */
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
  const runner = useActionRunner();
  const { pending, error, message: info } = runner;
  const editor = usePackageEditor({
    jobId,
    jobTitle,
    companyName,
    suggestedMarket,
    initialPackage,
    hasApprovedProfile,
    canEmail,
    runner,
  });
  const { market, pkg, cv, letter, email, dirty, emailDirty, alreadySent } = editor;
  const { editCv, editLetter, editEmail, regenerateSummary, regenerateLetter } = editor;

  const [tab, setTab] = useState<Tab>("cv");
  const [showEvidence, setShowEvidence] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(openSendOnMount);
  // Arriving with ?send=1 again (e.g. from the list) reopens the send sheet.
  const [seenOpenSend, setSeenOpenSend] = useState(openSendOnMount);
  if (openSendOnMount !== seenOpenSend) {
    setSeenOpenSend(openSendOnMount);
    if (openSendOnMount) setSendOpen(true);
  }

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
        <PackageGenerateCard
          market={market}
          setMarket={editor.setMarket}
          pending={pending}
          hasApprovedProfile={hasApprovedProfile}
          generate={editor.generate}
        />
      ) : (
        <>
          <PackageToolbar
            editor={editor}
            tab={tab}
            setTab={setTab}
            pending={pending}
            canEmail={canEmail}
            mailboxConnected={mailboxConnected}
            hasPreview={Boolean(previewNode)}
            onOpenPreview={() => setPreviewOpen(true)}
            onOpenSend={() => setSendOpen(true)}
            showEvidence={showEvidence}
            setShowEvidence={setShowEvidence}
          />

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
                    onChange={editCv}
                    onRegenerateSummary={regenerateSummary}
                  />
                ) : null}
                {tab === "letter" && letter ? (
                  <PackageLetterSlotEditor
                    letter={letter}
                    pending={pending || alreadySent}
                    onChange={editLetter}
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
                    onChange={editEmail}
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

