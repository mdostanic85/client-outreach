"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationEmailDraft } from "@/modules/applications/application-email";
import { cn } from "@/lib/utils";

export function PackageEmailEditor({
  email,
  pending,
  fromName,
  fromEmail,
  companyName,
  onChange,
}: {
  email: ApplicationEmailDraft;
  pending: boolean;
  fromName: string;
  fromEmail?: string;
  companyName: string;
  onChange: (next: ApplicationEmailDraft) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[16px] font-medium tracking-tight text-foreground">
          Application email
        </p>
        <p className="text-muted-foreground text-[14px] leading-relaxed">
          Edit the email, then use Send. Body stays aligned with the cover
          letter until you change it here.
        </p>
      </div>

      <div className="border-border bg-muted/20 space-y-0 overflow-hidden rounded-2xl border">
        <EmailField
          label="From"
          value={
            fromEmail
              ? `${fromName || "You"} <${fromEmail}>`
              : fromName || "You"
          }
          readOnly
        />
        <EmailField
          label="To"
          value={email.to}
          placeholder={`${companyName} hiring · add email if you have it`}
          disabled={pending}
          onChange={(to) => onChange({ ...email, to })}
        />
        <EmailField
          label="Subject"
          value={email.subject}
          disabled={pending}
          onChange={(subject) => onChange({ ...email, subject })}
        />
        <div className="space-y-2 px-4 py-3">
          <Label className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Body
          </Label>
          <Textarea
            className="min-h-[280px] resize-y border-0 bg-transparent px-0 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
            value={email.body}
            disabled={pending}
            onChange={(e) => onChange({ ...email, body: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function EmailField({
  label,
  value,
  placeholder,
  readOnly,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="border-border flex items-center gap-3 border-b px-4 py-2.5">
      <span className="text-muted-foreground w-16 shrink-0 text-[12px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {readOnly ? (
        <p className="text-[14px] text-foreground">{value}</p>
      ) : (
        <Input
          className="h-8 border-0 bg-transparent px-0 text-[14px] shadow-none focus-visible:ring-0"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  );
}

export function ApplicationEmailPreview({
  email,
  fromName,
  fromEmail,
  className,
}: {
  email: ApplicationEmailDraft;
  fromName: string;
  fromEmail?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "app-doc app-email-preview mx-auto w-full max-w-[210mm]",
        className,
      )}
      data-doc="email"
    >
      <div className="app-email-chrome">
        <div className="app-email-row">
          <span className="app-email-label">From</span>
          <span className="app-email-value">
            {fromEmail
              ? `${fromName || "You"} <${fromEmail}>`
              : fromName || "You"}
          </span>
        </div>
        <div className="app-email-row">
          <span className="app-email-label">To</span>
          <span className="app-email-value">
            {email.to.trim() || "Hiring team"}
          </span>
        </div>
        <div className="app-email-row app-email-row-last">
          <span className="app-email-label">Subject</span>
          <span className="app-email-subject">{email.subject || "—"}</span>
        </div>
      </div>
      <div className="app-email-body whitespace-pre-wrap">{email.body}</div>
    </article>
  );
}
