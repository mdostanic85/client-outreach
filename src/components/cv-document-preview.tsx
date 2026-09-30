import type { CSSProperties, ReactNode } from "react";
import { visibleCvSections, type CvSectionId } from "@/modules/applications/cv-layout";
import { marketLabels } from "@/modules/applications/market";
import type { PackageMarket, TailoredCv } from "@/modules/applications/schemas";
import { cn } from "@/lib/utils";

/**
 * A4 single-column ATS CV / Resume preview.
 * Shared visual language with cover letter + apply email.
 */
export function CvDocumentPreview({
  cv,
  market,
  className,
}: {
  cv: TailoredCv;
  market: PackageMarket;
  className?: string;
}) {
  const labels = marketLabels(market, cv.outputLanguage, cv.template);
  const experience = cv.experience.filter((e) => e.included);
  const projects = cv.projects.filter((p) => p.included);
  const contactBits = [cv.location, cv.email, cv.phone].filter(Boolean);
  const links = cv.links.filter(Boolean);

  function renderSection(id: CvSectionId): ReactNode {
    switch (id) {
      case "summary":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.summaryHeading}</SectionTitle>
            <p className="app-doc-body app-doc-summary">{cv.summary}</p>
          </section>
        );
      case "skills":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.skillsHeading}</SectionTitle>
            <ul className="app-doc-skill-row">
              {cv.skills.map((skill) => (
                <li key={skill} className="app-doc-skill">
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        );
      case "experience":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.experienceHeading}</SectionTitle>
            <div className="app-doc-stack">
              {experience.map((exp) => (
                <div key={exp.id} className="app-doc-entry">
                  <div className="app-doc-entry-head">
                    <p className="app-doc-role">
                      <span className="app-doc-role-title">{exp.role}</span>
                    </p>
                    {(exp.start || exp.end) && (
                      <p className="app-doc-dates">
                        {[exp.start, exp.end].filter(Boolean).join(" – ")}
                      </p>
                    )}
                  </div>
                  <p className="app-doc-org-line">
                    <span className="app-doc-role-org">{exp.organization}</span>
                    {exp.location ? (
                      <>
                        <span className="app-doc-sep" aria-hidden>
                          ·
                        </span>
                        <span className="app-doc-meta-inline">{exp.location}</span>
                      </>
                    ) : null}
                  </p>
                  {exp.bullets.length ? (
                    <ul className="app-doc-bullets">
                      {exp.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      case "projects":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.projectsHeading}</SectionTitle>
            <div className="app-doc-stack">
              {projects.map((p) => (
                <div key={p.id} className="app-doc-entry">
                  <p className="app-doc-role">
                    <span className="app-doc-role-title">{p.title}</span>
                  </p>
                  {p.summary ? (
                    <p className="app-doc-body app-doc-project-summary">
                      {p.summary}
                    </p>
                  ) : null}
                  {p.outcomes.length ? (
                    <ul className="app-doc-bullets">
                      {p.outcomes.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      case "education":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.educationHeading}</SectionTitle>
            <ul className="app-doc-lines">
              {cv.education.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </section>
        );
      case "certifications":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.certificationsHeading}</SectionTitle>
            <ul className="app-doc-lines">
              {cv.certifications.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        );
      case "languages":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.languagesHeading}</SectionTitle>
            <p className="app-doc-body">{cv.languages.join("  ·  ")}</p>
          </section>
        );
      case "licenses":
        return (
          <section key={id} className="app-doc-section">
            <SectionTitle>{labels.licensesHeading}</SectionTitle>
            <p className="app-doc-body">{cv.licenses.join("  ·  ")}</p>
          </section>
        );
    }
  }

  return (
    <article
      className={cn("app-doc app-doc-page mx-auto w-full max-w-[210mm]", className)}
      style={docVars}
      data-doc="cv"
    >
      <div className="app-doc-inner">
        <header className="app-doc-header">
          <h1 className="app-doc-name">{cv.fullName}</h1>
          {cv.headline ? (
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

        {visibleCvSections(cv).map((id) => renderSection(id))}
      </div>
    </article>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="app-doc-section-title">{children}</h2>;
}

const docVars = {
  ["--doc-name" as string]: "22pt",
  ["--doc-headline" as string]: "11pt",
  ["--doc-section" as string]: "9.5pt",
  ["--doc-role" as string]: "10.5pt",
  ["--doc-body" as string]: "10pt",
  ["--doc-meta" as string]: "9pt",
} as CSSProperties;
