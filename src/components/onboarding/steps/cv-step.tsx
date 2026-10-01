"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { ingestCvAction, ingestPortfolioUrlAction } from "@/modules/profile/actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PrimaryButton, Screen } from "@/components/onboarding/ui";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function useFileUpload(kind: "cv" | "linkedin_text", onUploaded: (name: string) => void) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is over 8 MB. Export a smaller PDF.");
      return;
    }
    if (!/\.(pdf|txt|md)$/i.test(file.name)) {
      setError("Upload a PDF.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", kind);
    startTransition(async () => {
      const result = await ingestCvAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUploaded(file.name);
    });
  }

  return { upload, pending, error };
}

function DropZone({
  title,
  hint,
  doneLabel,
  pending,
  onFile,
  compact,
}: {
  title: string;
  hint: string;
  doneLabel: string | null;
  pending: boolean;
  onFile: (file: File | undefined) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFile(event.dataTransfer.files[0]);
      }}
      disabled={pending}
      className={cn(
        "bg-card flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed text-center transition-colors duration-150 ease-standard shadow-card",
        compact ? "px-6 py-10" : "min-h-64 px-6 py-16 sm:min-h-72 sm:py-20",
        dragging ? "border-brand bg-brand-wash" : "border-ink-tertiary hover:border-brand",
        doneLabel && "border-brand border-solid",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {pending ? (
        <Loader2 className="text-brand-ink size-10 animate-spin" aria-hidden />
      ) : doneLabel ? (
        <FileText className="text-brand-ink size-10" aria-hidden />
      ) : (
        <UploadCloud className="text-muted-foreground size-10" aria-hidden />
      )}
      <span className="text-h5 text-foreground">
        {pending ? "Reading your file…" : doneLabel ?? title}
      </span>
      <span className="text-muted-foreground text-body-sm">{doneLabel ? "Click to replace" : hint}</span>
    </button>
  );
}

export function CvStep({
  uploaded,
  askWebsite,
  askLinkedin,
  initialWebsite,
  onUploaded,
  onContinue,
}: {
  uploaded: boolean;
  askWebsite: boolean;
  askLinkedin: boolean;
  initialWebsite: string;
  onUploaded: () => void;
  onContinue: (websiteUrl?: string) => Promise<void>;
}) {
  const [fileName, setFileName] = useState<string | null>(uploaded ? "CV uploaded" : null);
  const [website, setWebsite] = useState(initialWebsite);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const { upload, pending, error } = useFileUpload("cv", (name) => {
    setFileName(name);
    onUploaded();
  });
  const [linkedinName, setLinkedinName] = useState<string | null>(null);
  const linkedin = useFileUpload("linkedin_text", setLinkedinName);

  function finish() {
    const url = website.trim();
    startBusy(async () => {
      if (askWebsite && url) {
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        const result = await ingestPortfolioUrlAction(normalized);
        if (!result.ok) {
          setSiteError("We couldn't open that site. Check the address, or leave it blank.");
          return;
        }
        await onContinue(normalized);
        return;
      }
      await onContinue(undefined);
    });
  }

  return (
    <Screen title="Your CV" hint="PDF works best. A site or LinkedIn export is optional.">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <DropZone
          title="Drop your CV here"
          hint="or click to choose a PDF"
          doneLabel={fileName}
          pending={pending}
          onFile={upload}
        />
        {error ? <p role="alert" className="text-destructive text-body">{error}</p> : null}
        {askWebsite ? (
          <Input
            value={website}
            onChange={(event) => {
              setWebsite(event.target.value);
              setSiteError(null);
            }}
            placeholder="yourname.com — optional"
            inputMode="url"
            className="h-16 rounded-2xl text-center text-h5"
          />
        ) : null}
        {siteError ? <p role="alert" className="text-destructive text-body">{siteError}</p> : null}
        {askLinkedin ? (
          <DropZone
            compact
            title="LinkedIn PDF, if you have one"
            hint="More → Save to PDF. Optional."
            doneLabel={linkedinName}
            pending={linkedin.pending}
            onFile={linkedin.upload}
          />
        ) : null}
        {linkedin.error ? <p role="alert" className="text-destructive text-body">{linkedin.error}</p> : null}
        <PrimaryButton disabled={!fileName || pending || busy || linkedin.pending} onClick={finish}>
          {busy ? "Opening your site…" : "Analyze"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
