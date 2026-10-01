"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PanelBody, Surface } from "@/components/page-shell";
import { cn } from "@/lib/utils";

import { ChipListField, CompensationField, EmploymentTypeField, Field, ProfileSection } from "@/components/profile/profile-fields";
import type { ProfileFormValues } from "@/modules/profile/profile-form";

export type ReviewTab = "essentials" | "skills" | "preferences" | "advanced";

/** `?fix=` values from Market fit CTAs. */
export type ProfileFixTarget =
  | "sources"
  | "essentials"
  | "skills"
  | "preferences"
  | "evidence"
  | "advanced";

export function reviewTabFromFix(fix: string | null): ReviewTab | null {
  if (
    fix === "essentials" ||
    fix === "skills" ||
    fix === "preferences" ||
    fix === "advanced"
  ) {
    return fix;
  }
  if (fix === "evidence") return "advanced";
  return null;
}

const REVIEW_TABS: Array<{
  id: ReviewTab;
  label: string;
  description: string;
}> = [
  {
    id: "essentials",
    label: "Essentials",
    description: "Who you are and what roles you’re targeting.",
  },
  {
    id: "skills",
    label: "Skills",
    description: "Strengths, industries, and tools used for matching.",
  },
  {
    id: "preferences",
    label: "Job prefs",
    description: "Pay, employment type, and roles to skip.",
  },
  {
    id: "advanced",
    label: "More",
    description: "Project details for deeper match context.",
  },
];

/** The draft profile, one tab at a time. Edits stay local until Save or Approve. */
export function ProfileDraftEditor({
  values,
  set,
  canEdit,
  reviewTab,
  setReviewTab,
}: {
  values: ProfileFormValues;
  set: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  canEdit: boolean;
  reviewTab: ReviewTab;
  setReviewTab: (tab: ReviewTab) => void;
}) {
  const tags = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string,
  ) => (
    <ChipListField
      label={label}
      value={value}
      onChange={onChange}
      disabled={!canEdit}
      placeholder={placeholder}
    />
  );

  const essentialsFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Role"
        description="How you present yourself in matching and outreach."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Current role">
            <Input
              value={values.currentRole}
              onChange={(e) => set("currentRole", e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Nurse, Truck Driver, Accountant"
            />
          </Field>
          <Field label="Seniority">
            <Input
              value={values.seniority}
              onChange={(e) => set("seniority", e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Senior"
            />
          </Field>
          <Field label="Years experience">
            <Input
              value={values.yearsExperience}
              onChange={(e) => set("yearsExperience", e.target.value)}
              disabled={!canEdit}
              inputMode="numeric"
            />
          </Field>
          <Field label="Availability">
            <Input
              value={values.availability}
              onChange={(e) => set("availability", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </ProfileSection>
      <ProfileSection
        title="Targets"
        description="Roles and places you want Optra to prioritize."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Target roles", values.targetRoles, (v) => set("targetRoles", v), "Role + Enter")}
          {tags(
            "Locations",
            values.preferredLocations,
            (v) => set("preferredLocations", v),
            "City / Remote + Enter",
          )}
        </div>
      </ProfileSection>
    </div>
  );

  const skillsFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Strengths"
        description="What you’re strongest at — used heavily in scoring."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Strongest skills", values.strongestSkills, (v) => set("strongestSkills", v))}
          {tags(
            "Differentiators",
            values.strengthsAndDifferentiators,
            (v) => set("strengthsAndDifferentiators", v),
          )}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Domain"
        description="Industries and product contexts you’ve worked in."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Industries", values.industries, (v) => set("industries", v))}
          {tags("Product types", values.productTypes, (v) => set("productTypes", v))}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Tools and licences"
        description="Software, equipment, driving licence categories and professional licences."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Tools", values.tools, (v) => set("tools", v))}
          {tags("Licences", values.licenses, (v) => set("licenses", v))}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Leadership"
        description="Optional. Team size, management, or mentoring — in your words."
      >
        <Textarea
          value={values.leadershipExperience}
          onChange={(e) => set("leadershipExperience", e.target.value)}
          disabled={!canEdit}
          rows={3}
          placeholder="e.g. Led a shift of 6 nurses, or a team of 4 developers"
          className="min-h-[5.5rem] text-body-sm"
        />
      </ProfileSection>
    </div>
  );

  const preferencesFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Compensation & type"
        description="Hard filters for pay and employment style."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CompensationField
            value={values.compensation}
            onChange={(v) => set("compensation", v)}
            disabled={!canEdit}
          />
          <EmploymentTypeField
            value={values.preferredEmploymentTypes}
            onChange={(v) => set("preferredEmploymentTypes", v)}
            disabled={!canEdit}
          />
        </div>
      </ProfileSection>
      <ProfileSection
        title="Logistics"
        description="Where and how you prefer to work."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags("Time zones", values.timeZones, (v) => set("timeZones", v))}
          {tags("Languages", values.languages, (v) => set("languages", v))}
        </div>
      </ProfileSection>
      <ProfileSection
        title="Role filters"
        description="Titles that are clearly too junior or too senior for you."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tags(
            "Roles that are too junior",
            values.rolesBelowLevel,
            (v) => set("rolesBelowLevel", v),
          )}
          {tags(
            "Roles that are too senior",
            values.rolesAboveLevel,
            (v) => set("rolesAboveLevel", v),
          )}
        </div>
      </ProfileSection>
    </div>
  );

  const advancedFields = (
    <div className="space-y-4">
      <ProfileSection
        title="Projects"
        description="Structured project data (JSON). Used for deeper portfolio-aware matching when enabled."
      >
        <Field label="Projects JSON">
          <Textarea
            value={values.projectsJson}
            onChange={(e) => set("projectsJson", e.target.value)}
            disabled={!canEdit}
            rows={10}
            className="font-mono text-body"
          />
        </Field>
      </ProfileSection>
    </div>
  );

  function renderReviewFields() {
    switch (reviewTab) {
      case "essentials":
        return essentialsFields;
      case "skills":
        return skillsFields;
      case "preferences":
        return preferencesFields;
      case "advanced":
        return advancedFields;
    }
  }

  const activeTabMeta =
    REVIEW_TABS.find((t) => t.id === reviewTab) ?? REVIEW_TABS[0]!;

  function renderTabChrome(actions?: React.ReactNode) {
    return (
      <div className="border-border space-y-3 border-b px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Profile sections"
            className="bg-subtle flex flex-wrap gap-0.5 rounded-full p-1"
          >
            {REVIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={reviewTab === tab.id ? "page" : undefined}
                onClick={() => setReviewTab(tab.id)}
                className={cn(
                  "h-9 rounded-full px-4 text-body-sm font-medium transition-colors duration-150 ease-standard",
                  reviewTab === tab.id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {actions}
        </div>
        <p className="text-muted-foreground text-body-sm leading-relaxed">
          {activeTabMeta.description}
        </p>
      </div>
    );
  }

  return (
    <Surface>
      {renderTabChrome()}
      <PanelBody className="space-y-6">{renderReviewFields()}</PanelBody>
    </Surface>
  );
}
