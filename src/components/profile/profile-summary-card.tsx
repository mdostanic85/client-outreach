import { Surface } from "@/components/page-shell";
import type { StructuredProfile } from "@/modules/profile/schemas";
import { formatCompensation, roleWithLevel } from "@/modules/profile/schemas";


function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6 sm:px-6">
      <dt className="text-muted-foreground w-36 shrink-0 text-body-sm">{label}</dt>
      <dd className="min-w-0 flex-1 text-body leading-relaxed text-foreground">
        {children}
      </dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="bg-subtle rounded-full px-3 py-1 text-body-sm">
          {item}
        </span>
      ))}
    </div>
  );
}

/** Read-only view of the approved profile — editing is one click away. */
export function ProfileSummaryCard({
  profile,
  action,
}: {
  profile: StructuredProfile;
  action: React.ReactNode;
}) {
  const headline = roleWithLevel(
    profile.seniority,
    profile.targetRoles[0] ?? profile.currentRole,
  );
  const projects = profile.relevantProjects.slice(0, 6);
  const wants = [
    profile.preferredEmploymentTypes.join(", "),
    profile.preferredLocations.join(", "),
    formatCompensation(profile.compensation) ?? profile.salaryOrRateExpectations,
    profile.availability,
  ].filter((v): v is string => Boolean(v?.trim()));
  const domains = [...profile.industries, ...profile.productTypes].slice(0, 8);

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="font-heading text-h5 font-medium text-foreground">
            {headline || "Your profile"}
          </p>
          {profile.yearsExperience ? (
            <p className="text-muted-foreground mt-0.5 text-body-sm">
              {profile.yearsExperience} years of experience
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <dl className="border-border divide-border divide-y border-t">
        {profile.professionalSummary ? (
          <SummaryRow label="Summary">{profile.professionalSummary}</SummaryRow>
        ) : null}
        {profile.strongestSkills.length ? (
          <SummaryRow label="Skills">
            <Chips items={profile.strongestSkills.slice(0, 12)} />
          </SummaryRow>
        ) : null}
        {projects.length ? (
          <SummaryRow label="Work & projects">
            <ul className="space-y-1.5">
              {projects.map((project) => (
                <li key={project.title}>
                  <span className="font-medium">{project.title}</span>
                  {project.organization || project.role ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {[project.role, project.organization].filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </SummaryRow>
        ) : null}
        {domains.length ? (
          <SummaryRow label="Industries">
            <Chips items={domains} />
          </SummaryRow>
        ) : null}
        {wants.length ? <SummaryRow label="Looking for">{wants.join(" · ")}</SummaryRow> : null}
        {profile.languages.length ? (
          <SummaryRow label="Languages">{profile.languages.join(", ")}</SummaryRow>
        ) : null}
      </dl>
    </Surface>
  );
}
