import assert from "node:assert/strict";
import {
  buildBaseCv,
  applyCvSlotPatch,
  parseRoleAtOrganization,
} from "../src/modules/applications/base-cv";
import { tailoredCvToPlainText } from "../src/modules/applications/export-text";
import { validateGrounding } from "../src/modules/applications/grounding";
import { suggestMarket } from "../src/modules/applications/market";
import {
  CoverLetterSchema,
  type TailoredCv,
} from "../src/modules/applications/schemas";
import {
  EMPTY_STRUCTURED_PROFILE,
  type StructuredProfile,
} from "../src/modules/profile/schemas";

const profile: StructuredProfile = {
  ...EMPTY_STRUCTURED_PROFILE,
  currentRole: "Senior Product Designer",
  seniority: "Senior",
  yearsExperience: 8,
  strongestSkills: ["Figma", "Design Systems", "User Research"],
  designTools: ["Figma"],
  professionalSummary: "Senior product designer focused on B2B SaaS.",
  achievements: ["Led redesign that improved activation"],
  relevantProjects: [
    {
      title: "Senior Product Designer at Stripe",
      summary: "Owned checkout and billing UX for growth teams",
      outcomes: [
        "Led redesign that improved activation",
        "Built design system components used across billing",
      ],
      tools: ["Figma"],
      sourcePointers: ["source:linkedin"],
      evidenceKind: "general",
      organization: "Stripe",
      role: "Senior Product Designer",
      start: "2021",
      end: "Present",
      location: "Remote",
    },
    {
      title: "Product Designer at Acme",
      summary: "B2B SaaS product design",
      outcomes: ["Shipped onboarding redesign"],
      tools: ["Figma"],
      sourcePointers: ["source:cv"],
      evidenceKind: "general",
      organization: "Acme",
      role: "Product Designer",
      start: "2018",
      end: "2021",
    },
    {
      title: "Checkout redesign",
      summary: "End-to-end checkout UX for marketplace",
      outcomes: ["Raised conversion with clearer flow"],
      tools: ["Figma"],
      sourcePointers: ["portfolio"],
      evidenceKind: "portfolio_project",
    },
  ],
  education: ["BA Design"],
  languages: ["English", "Serbian"],
  preferredLocations: ["Remote Europe"],
};

function main() {
  assert.equal(suggestMarket({ jobLocation: "Berlin", companyCountry: "DE" }), "europe");
  assert.equal(suggestMarket({ jobLocation: "San Francisco", salaryCurrency: "USD" }), "us");

  const parsed = parseRoleAtOrganization("Lead Designer at Notion");
  assert.equal(parsed.role, "Lead Designer");
  assert.equal(parsed.organization, "Notion");

  const base = buildBaseCv(profile, {
    fullName: "Miloš Dostanić",
    email: "milos@example.com",
    location: "Remote Europe",
  });
  assert.equal(base.fullName, "Miloš Dostanić");
  assert.ok(base.skills.includes("Figma"));
  assert.ok(base.projects.some((p) => p.title === "Checkout redesign"));

  // Work history from LinkedIn/CV must become experience with real orgs/roles/dates.
  assert.equal(base.experience.length, 2);
  assert.equal(base.experience[0]?.organization, "Stripe");
  assert.equal(base.experience[0]?.role, "Senior Product Designer");
  assert.equal(base.experience[0]?.start, "2021");
  assert.equal(base.experience[0]?.end, "Present");
  assert.ok(base.experience[0]?.included);
  assert.ok(
    base.experience[0]!.bullets.some((b) =>
      b.toLowerCase().includes("activation"),
    ),
  );
  assert.equal(base.experience[1]?.organization, "Acme");
  assert.equal(base.experience[1]?.role, "Product Designer");

  // Title-only general roles should still parse role/org.
  const titleOnly = buildBaseCv(
    {
      ...EMPTY_STRUCTURED_PROFILE,
      currentRole: "Designer",
      relevantProjects: [
        {
          title: "UX Designer at Linear",
          outcomes: ["Improved issue triage UX"],
          tools: [],
          sourcePointers: ["source:linkedin"],
          evidenceKind: "general",
        },
      ],
    },
    { fullName: "Test User" },
  );
  assert.equal(titleOnly.experience[0]?.organization, "Linear");
  assert.equal(titleOnly.experience[0]?.role, "UX Designer");

  const patched = applyCvSlotPatch(base, {
    summary: "Senior product designer for B2B product teams.",
    skills: ["User Research", "Figma", "Design Systems"],
    projects: [{ id: base.projects[0]!.id, included: true }],
    experience: base.experience.map((e) => ({
      id: e.id,
      included: false,
      bullets: e.bullets.slice(0, 2),
    })),
  });
  assert.equal(patched.summary.startsWith("Senior product designer"), true);
  assert.equal(patched.skills[0], "User Research");
  // Guardrail: do not let personalization wipe career history.
  assert.ok(patched.experience.filter((e) => e.included).length >= 2);

  // Invented skill must not survive allowed filter when we only reorder known ones —
  // applyCvSlotPatch drops unknowns from skills list.
  const withInvented = applyCvSlotPatch(base, {
    skills: ["Figma", "MadeUpSkillXYZ"],
  });
  assert.ok(!withInvented.skills.includes("MadeUpSkillXYZ"));

  const letter = CoverLetterSchema.parse({
    greeting: "Dear Hiring Team,",
    opening: "I am applying for the role.",
    body: "I led checkout redesign work at Stripe.",
    closing: "Thank you.",
    signOff: "Best regards,",
    fullName: "Miloš Dostanić",
  });

  const grounding = validateGrounding({
    profile,
    cv: patched,
    letter,
    companyName: "Acme",
    jobTitle: "Product Designer",
  });
  assert.equal(grounding.ok, true);

  const inventedCv: TailoredCv = {
    ...patched,
    skills: [...patched.skills, "QuantumTeleportation"],
  };
  const bad = validateGrounding({
    profile,
    cv: inventedCv,
    letter,
    companyName: "Acme",
    jobTitle: "Product Designer",
  });
  assert.equal(bad.ok, false);

  const text = tailoredCvToPlainText(patched, "europe");
  assert.ok(text.includes("Miloš Dostanić".toUpperCase()) || text.includes("MILOŠ"));
  assert.ok(text.includes("Skills") || text.includes("SKILLS"));
  assert.ok(text.includes("Stripe"));
  assert.ok(text.includes("Senior Product Designer"));
  assert.ok(!text.includes("font-size: 10"));

  console.log("application-package.test.ts: ok");
}

main();
