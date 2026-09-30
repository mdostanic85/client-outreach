"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CV_TEMPLATE_LABELS } from "@/modules/applications/cv-layout";
import {
  CvTemplateSchema,
  type CoverLetter,
  type PackageMarket,
  type TailoredCv,
} from "@/modules/applications/schemas";
import { cn } from "@/lib/utils";

function EditorSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-[15px] font-semibold tracking-tight text-[var(--card-foreground)]">
            {title}
          </h3>
          {description ? (
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PackageCvSlotEditor({
  cv,
  market,
  pending,
  onChange,
  onRegenerateSummary,
}: {
  cv: TailoredCv;
  market: PackageMarket;
  pending: boolean;
  onChange: (cv: TailoredCv) => void;
  onRegenerateSummary: () => void;
}) {
  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="font-display text-[16px] font-semibold tracking-tight text-[var(--card-foreground)]">
          {market === "us" ? "Resume" : "CV"} content
        </p>
        <p className="text-muted-foreground text-[14px] leading-relaxed">
          Edit slots that feed the live A4 preview. Include only roles and
          projects you want on the page.
        </p>
      </div>

      <EditorSection
        title="Layout"
        description="Chosen for your field. Europass is the format many EU employers know."
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="CV layout">
          {CvTemplateSchema.options.map((template) => (
            <button
              key={template}
              type="button"
              role="radio"
              aria-checked={cv.template === template}
              disabled={pending}
              onClick={() => onChange({ ...cv, template })}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors disabled:opacity-50",
                cv.template === template
                  ? "border-primary bg-primary/12 text-[var(--card-foreground)]"
                  : "border-border hover:border-primary/50",
              )}
            >
              {CV_TEMPLATE_LABELS[template]}
            </button>
          ))}
        </div>
      </EditorSection>

      <EditorSection title="Identity">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input
              value={cv.fullName}
              disabled={pending}
              onChange={(e) => onChange({ ...cv, fullName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Headline</Label>
            <Input
              value={cv.headline ?? ""}
              disabled={pending}
              placeholder="Senior Product Designer"
              onChange={(e) => onChange({ ...cv, headline: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={cv.email ?? ""}
                disabled={pending}
                onChange={(e) => onChange({ ...cv, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={cv.location ?? ""}
                disabled={pending}
                onChange={(e) => onChange({ ...cv, location: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Links</Label>
            <Input
              value={cv.links.join(", ")}
              disabled={pending}
              placeholder="LinkedIn, portfolio…"
              onChange={(e) =>
                onChange({
                  ...cv,
                  links: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      </EditorSection>

      <EditorSection
        title={market === "us" ? "Summary" : "Profile"}
        description="2–3 lines tailored to this role."
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onRegenerateSummary}
          >
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        }
      >
        <Textarea
          className="min-h-24"
          value={cv.summary}
          disabled={pending}
          onChange={(e) => onChange({ ...cv, summary: e.target.value })}
        />
      </EditorSection>

      <EditorSection
        title="Skills"
        description="Comma-separated. Order matters for scanning."
      >
        <Textarea
          className="min-h-20"
          value={cv.skills.join(", ")}
          disabled={pending}
          onChange={(e) =>
            onChange({
              ...cv,
              skills: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </EditorSection>

      <EditorSection
        title="Experience"
        description="Toggle roles on or off. One bullet per line."
      >
        <div className="space-y-3">
          {cv.experience.map((exp, idx) => (
            <div
              key={exp.id}
              className={cn(
                "border-border space-y-3 rounded-2xl border p-4",
                !exp.included && "opacity-55",
              )}
            >
              <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  className="border-input size-4 rounded"
                  checked={exp.included}
                  disabled={pending}
                  onChange={(e) => {
                    const experience = [...cv.experience];
                    experience[idx] = { ...exp, included: e.target.checked };
                    onChange({ ...cv, experience });
                  }}
                />
                <span className="font-medium text-[var(--card-foreground)]">
                  Include on page
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={exp.role}
                    disabled={pending}
                    onChange={(e) => {
                      const experience = [...cv.experience];
                      experience[idx] = { ...exp, role: e.target.value };
                      onChange({ ...cv, experience });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    value={exp.organization}
                    disabled={pending}
                    onChange={(e) => {
                      const experience = [...cv.experience];
                      experience[idx] = {
                        ...exp,
                        organization: e.target.value,
                      };
                      onChange({ ...cv, experience });
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    value={exp.start ?? ""}
                    disabled={pending}
                    placeholder="2022"
                    onChange={(e) => {
                      const experience = [...cv.experience];
                      experience[idx] = { ...exp, start: e.target.value };
                      onChange({ ...cv, experience });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input
                    value={exp.end ?? ""}
                    disabled={pending}
                    placeholder="Present"
                    onChange={(e) => {
                      const experience = [...cv.experience];
                      experience[idx] = { ...exp, end: e.target.value };
                      onChange({ ...cv, experience });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={exp.location ?? ""}
                    disabled={pending}
                    onChange={(e) => {
                      const experience = [...cv.experience];
                      experience[idx] = { ...exp, location: e.target.value };
                      onChange({ ...cv, experience });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bullets</Label>
                <Textarea
                  className="min-h-28"
                  value={exp.bullets.join("\n")}
                  disabled={pending}
                  onChange={(e) => {
                    const experience = [...cv.experience];
                    experience[idx] = {
                      ...exp,
                      bullets: e.target.value
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean),
                    };
                    onChange({ ...cv, experience });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </EditorSection>

      {cv.projects.length ? (
        <EditorSection
          title="Selected work"
          description="Case studies with outcomes land strongest for senior roles."
          action={
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="border-input size-4 rounded"
                checked={cv.includeProjects}
                disabled={pending}
                onChange={(e) =>
                  onChange({ ...cv, includeProjects: e.target.checked })
                }
              />
              Show section
            </label>
          }
        >
          <div className="space-y-3">
            {cv.projects.map((p, idx) => (
              <div
                key={p.id}
                className={cn(
                  "border-border space-y-3 rounded-2xl border p-4",
                  !p.included && "opacity-55",
                )}
              >
                <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
                  <input
                    type="checkbox"
                    className="border-input size-4 rounded"
                    checked={p.included}
                    disabled={pending}
                    onChange={(e) => {
                      const projects = [...cv.projects];
                      projects[idx] = { ...p, included: e.target.checked };
                      onChange({ ...cv, projects });
                    }}
                  />
                  <span className="font-medium text-[var(--card-foreground)]">
                    {p.title}
                  </span>
                </label>
                <Textarea
                  className="min-h-20"
                  value={p.summary ?? ""}
                  disabled={pending}
                  placeholder="Short project summary"
                  onChange={(e) => {
                    const projects = [...cv.projects];
                    projects[idx] = { ...p, summary: e.target.value };
                    onChange({ ...cv, projects });
                  }}
                />
                <Textarea
                  className="min-h-20"
                  value={p.outcomes.join("\n")}
                  disabled={pending}
                  placeholder="Outcomes — one per line"
                  onChange={(e) => {
                    const projects = [...cv.projects];
                    projects[idx] = {
                      ...p,
                      outcomes: e.target.value
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean),
                    };
                    onChange({ ...cv, projects });
                  }}
                />
              </div>
            ))}
          </div>
        </EditorSection>
      ) : null}

      <EditorSection title="Extras">
        <div className="flex flex-wrap gap-5">
          <label className="flex cursor-pointer items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              className="border-input size-4 rounded"
              checked={cv.includeLanguages}
              disabled={pending}
              onChange={(e) =>
                onChange({ ...cv, includeLanguages: e.target.checked })
              }
            />
            Languages
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              className="border-input size-4 rounded"
              checked={cv.includeCertifications}
              disabled={pending}
              onChange={(e) =>
                onChange({ ...cv, includeCertifications: e.target.checked })
              }
            />
            Certifications
          </label>
          {cv.licenses.length ? (
            <label className="flex cursor-pointer items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                className="border-input size-4 rounded"
                checked={cv.includeLicenses}
                disabled={pending}
                onChange={(e) =>
                  onChange({ ...cv, includeLicenses: e.target.checked })
                }
              />
              Licences
            </label>
          ) : null}
        </div>
      </EditorSection>
    </div>
  );
}

export function PackageLetterSlotEditor({
  letter,
  pending,
  onChange,
  onRegenerate,
}: {
  letter: CoverLetter;
  pending: boolean;
  onChange: (letter: CoverLetter) => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-display text-[16px] font-semibold tracking-tight text-[var(--card-foreground)]">
            Cover letter
          </p>
          <p className="text-muted-foreground max-w-md text-[14px] leading-relaxed">
            Keep it to a short ask with one or two proof points. Same voice as
            the apply email.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onRegenerate}
        >
          <RefreshCw className="size-3.5" />
          Regenerate
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Greeting</Label>
          <Input
            value={letter.greeting}
            disabled={pending}
            onChange={(e) => onChange({ ...letter, greeting: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Opening</Label>
          <Textarea
            className="min-h-24"
            value={letter.opening}
            disabled={pending}
            onChange={(e) => onChange({ ...letter, opening: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            className="min-h-32"
            value={letter.body}
            disabled={pending}
            onChange={(e) => onChange({ ...letter, body: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Closing</Label>
          <Textarea
            className="min-h-20"
            value={letter.closing}
            disabled={pending}
            onChange={(e) => onChange({ ...letter, closing: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Sign-off</Label>
            <Input
              value={letter.signOff}
              disabled={pending}
              onChange={(e) =>
                onChange({ ...letter, signOff: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={letter.fullName}
              disabled={pending}
              onChange={(e) =>
                onChange({ ...letter, fullName: e.target.value })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
