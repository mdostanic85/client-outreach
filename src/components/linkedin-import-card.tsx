"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { extractProfileAction, ingestCvAction } from "@/app/actions";
import { FileDropzone } from "@/components/file-dropzone";
import { InlineAlert } from "@/components/inline-alert";
import { PanelBody, PanelHeader, Surface } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * LinkedIn as an optional additional source — PDF Save-to-PDF MVP flow.
 * Does not claim a live LinkedIn API connection.
 */
export function LinkedInImportCard({
  onImported,
}: {
  onImported?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSteps, setShowSteps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewReady, setReviewReady] = useState(false);

  const upload = (file: File) => {
    setError(null);
    setMessage(null);
    setReviewReady(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("type", "linkedin_text");
      const result = await ingestCvAction(fd);
      if (!result.ok) {
        setError(result.error ?? "Upload failed");
        return;
      }
      const extracted = await extractProfileAction();
      if (!extracted.ok) {
        setMessage(
          "LinkedIn PDF saved. Generate a profile draft to review extracted facts before they affect matching.",
        );
        onImported?.();
        router.refresh();
        return;
      }
      setReviewReady(true);
      setMessage(
        "LinkedIn PDF imported. Review the draft below — approve only after checking new and updated facts.",
      );
      onImported?.();
      router.refresh();
    });
  };

  return (
    <Surface>
      <PanelHeader className="flex-col items-start gap-1">
        <p className="text-body font-medium">
          Add LinkedIn profile
        </p>
        <p className="text-muted-foreground text-body-sm leading-relaxed">
          LinkedIn can help us understand your work history, roles, skills,
          education, and professional background more accurately. It will be
          combined with your portfolio, CV, and manually added information.
        </p>
      </PanelHeader>
      <PanelBody className="space-y-5">
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        {message ? (
          <InlineAlert variant={reviewReady ? "info" : "success"}>
            {message}
          </InlineAlert>
        ) : null}

        <div className="bg-subtle space-y-3 rounded-panel px-4 py-4">
          <p className="text-body font-medium">How to add your LinkedIn profile</p>
          <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-body-sm leading-relaxed">
            <li>Open your LinkedIn profile.</li>
            <li>
              Select <strong className="text-foreground">Resources</strong> or{" "}
              <strong className="text-foreground">More</strong>.
            </li>
            <li>
              Choose <strong className="text-foreground">Save to PDF</strong>.
            </li>
            <li>Upload the downloaded PDF here.</li>
            <li>Review the extracted information before saving it.</li>
          </ol>
          <p className="text-muted-foreground text-body-sm">
            Optra does not connect directly to LinkedIn — you upload the PDF
            yourself.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowSteps((v) => !v)}
          >
            {showSteps ? "Hide" : "See"} detailed instructions
          </Button>
        </div>

        {showSteps ? (
          <div
            className={cn(
              "text-muted-foreground space-y-2 rounded-xl bg-subtle px-4 py-3 text-body-sm leading-relaxed",
            )}
          >
            <p>
              On desktop LinkedIn, open your profile → click the{" "}
              <strong className="text-foreground">Resources</strong> button
              (sometimes labeled More) near your profile photo →{" "}
              <strong className="text-foreground">Save to PDF</strong>.
            </p>
            <p>
              Upload that PDF with the control below. After import, Optra drafts
              updates to your Professional Profile so you can approve, edit, or
              reject items before they are used for matching.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-body-sm font-medium">Upload LinkedIn PDF</p>
          <FileDropzone
            accept=".pdf,application/pdf"
            disabled={pending}
            label={pending ? "Uploading…" : "Drop LinkedIn PDF or browse"}
            onFile={upload}
          />
        </div>
      </PanelBody>
    </Surface>
  );
}
