import type { CSSProperties } from "react";
import type { CoverLetter, TailoredCv } from "@/modules/applications/schemas";
import { cn } from "@/lib/utils";

/**
 * A4 cover letter preview — same type system as CV for package cohesion.
 */
export function CoverLetterPreview({
  letter,
  cv,
  companyName,
  jobTitle,
  className,
}: {
  letter: CoverLetter;
  /** Optional contact block from CV for letterhead consistency. */
  cv?: TailoredCv | null;
  companyName?: string;
  jobTitle?: string;
  className?: string;
}) {
  const name = letter.fullName || cv?.fullName || "";
  const contactBits = cv
    ? [cv.location, cv.email, cv.phone].filter(Boolean)
    : [];
  const links = cv?.links.filter(Boolean) ?? [];
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <article
      className={cn("app-doc app-doc-page mx-auto w-full max-w-[210mm]", className)}
      style={docVars}
      data-doc="letter"
    >
      <div className="app-doc-inner app-doc-letter">
        <header className="app-doc-header">
          {name ? <h1 className="app-doc-name">{name}</h1> : null}
          {cv?.headline ? (
            <p className="app-doc-headline">{cv.headline}</p>
          ) : null}
          {contactBits.length || links.length ? (
            <div className="app-doc-contact">
              {contactBits.length ? (
                <p>
                  {contactBits.map((bit, i) => (
                    <span key={`${bit}-${i}`}>
                      {i > 0 ? (
                        <span className="app-doc-sep" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      {bit}
                    </span>
                  ))}
                </p>
              ) : null}
              {links.length ? (
                <p>
                  {links.map((link, i) => (
                    <span key={`${link}-${i}`}>
                      {i > 0 ? (
                        <span className="app-doc-sep" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      {link}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="app-doc-accent" aria-hidden />
        </header>

        <div className="app-doc-letter-meta">
          <p className="app-doc-letter-date">{dateLabel}</p>
          {companyName ? (
            <div className="app-doc-letter-recipient">
              <p>Hiring Team</p>
              <p>{companyName}</p>
              {jobTitle ? (
                <p className="app-doc-letter-re">Re: {jobTitle}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="app-doc-letter-body">
          {letter.greeting ? (
            <p className="app-doc-letter-greeting">{letter.greeting}</p>
          ) : null}
          {letter.opening ? (
            <p className="whitespace-pre-wrap">{letter.opening}</p>
          ) : null}
          {letter.body ? (
            <p className="whitespace-pre-wrap">{letter.body}</p>
          ) : null}
          {letter.closing ? (
            <p className="whitespace-pre-wrap">{letter.closing}</p>
          ) : null}
          <div className="app-doc-signoff">
            <p>{letter.signOff || "Best regards,"}</p>
            <p className="app-doc-signoff-name">{name}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

const docVars = {
  ["--doc-name" as string]: "22pt",
  ["--doc-headline" as string]: "11pt",
  ["--doc-section" as string]: "9.5pt",
  ["--doc-role" as string]: "10.5pt",
  ["--doc-body" as string]: "10.5pt",
  ["--doc-meta" as string]: "9pt",
} as CSSProperties;
