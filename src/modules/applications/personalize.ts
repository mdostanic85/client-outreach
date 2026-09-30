import { z } from "zod";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import {
  APPLICATION_ANALYSIS_PROMPT_VERSION,
  APPLICATION_COVER_LETTER_PROMPT_VERSION,
  APPLICATION_CV_SLOTS_PROMPT_VERSION,
  loadPrompt,
} from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import type { StructuredProfile } from "@/modules/profile/schemas";
import { applyCvSlotPatch, type ContactHeader, buildBaseCv } from "./base-cv";
import { buildPackageWarnings, validateGrounding } from "./grounding";
import { detectPostingLanguage } from "./language";
import { marketLabels } from "./market";
import { resolveFamily } from "@/modules/occupations/search";
import {
  CoverLetterSchema,
  CvSlotPatchSchema,
  PackageAnalysisSchema,
  type CoverLetter,
  type PackageAnalysis,
  type PackageMarket,
  type PackageWarning,
  type TailoredCv,
  type GroundingReport,
} from "./schemas";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

const AnalysisLlmSchema = PackageAnalysisSchema.extend({
  summaryPatch: z.string().optional(),
  skillOrder: z.array(z.string()).optional(),
});

export type PersonalizeResult = {
  cv: TailoredCv;
  letter: CoverLetter;
  analysis: PackageAnalysis;
  grounding: GroundingReport;
  warnings: PackageWarning[];
  model: string;
  promptVersion: string;
};

export async function personalizeApplicationPackage(input: {
  profile: StructuredProfile;
  contact: ContactHeader;
  market: PackageMarket;
  job: {
    title: string;
    description: string;
    location?: string | null;
    companyName: string;
    matchingReasons?: string[];
    concerns?: string[];
    missingRequirements?: string[];
  };
  companySummary?: string | null;
  marketConfirmed?: boolean;
}): Promise<PersonalizeResult> {
  // CV and letter follow the posting's language (Serbian posting → Serbian CV).
  const outputLanguage = detectPostingLanguage(`${input.job.title}\n${input.job.description}`);
  const baseCv = buildBaseCv(input.profile, input.contact, { outputLanguage });
  const labels = marketLabels(input.market, outputLanguage, baseCv.template);

  const analysis = await runAnalysis({
    profile: input.profile,
    baseCv,
    job: input.job,
    companySummary: input.companySummary,
    market: input.market,
  });

  const slotPatch = await runCvSlotPatch({
    baseCv,
    analysis,
    job: input.job,
    market: input.market,
    spellingHint: labels.spellingHint,
  });

  let cv = applyCvSlotPatch(baseCv, {
    summary: slotPatch.summary ?? analysis.summaryPatch,
    skills: slotPatch.skills ?? analysis.skillOrder ?? analysis.recommendedSkillOrder,
    experience: slotPatch.experience,
    projects: slotPatch.projects?.length
      ? slotPatch.projects
      : analysis.recommendedProjectIds.map((id) => ({
          id,
          included: true,
        })),
    includeProjects: slotPatch.includeProjects,
    includeLanguages: slotPatch.includeLanguages,
    includeCertifications: slotPatch.includeCertifications,
  });

  // Ensure recommended projects are included when the layout has a projects section.
  if (
    analysis.recommendedProjectIds.length &&
    (cv.template === "projects" || cv.template === "europass")
  ) {
    const want = new Set(analysis.recommendedProjectIds);
    cv = {
      ...cv,
      projects: cv.projects.map((p) => ({
        ...p,
        included: want.has(p.id) ? true : p.included && want.size >= 3 ? false : p.included,
      })),
      includeProjects: true,
    };
  }

  const letter = await runCoverLetter({
    profile: input.profile,
    cv,
    job: input.job,
    companySummary: input.companySummary,
    market: input.market,
    spellingHint: labels.spellingHint,
    fullName: input.contact.fullName,
  });

  let grounding = validateGrounding({
    profile: input.profile,
    cv,
    letter,
    companyName: input.job.companyName,
    jobTitle: input.job.title,
  });

  // Strip invented skills if grounding failed on skills.
  if (!grounding.ok) {
    const allowed = new Set(
      [
        ...input.profile.strongestSkills,
        ...input.profile.tools,
        ...input.profile.domainExpertise,
      ].map((s) => s.toLowerCase()),
    );
    cv = {
      ...cv,
      skills: cv.skills.filter((s) => allowed.has(s.toLowerCase())),
      projects: cv.projects.filter((p) =>
        input.profile.relevantProjects.some(
          (rp) => rp.title.toLowerCase() === p.title.toLowerCase(),
        ),
      ),
    };
    grounding = validateGrounding({
      profile: input.profile,
      cv,
      letter,
      companyName: input.job.companyName,
      jobTitle: input.job.title,
    });
  }

  const warnings = buildPackageWarnings({
    hasDescription: Boolean(input.job.description?.trim()),
    projectCount: input.profile.relevantProjects.length,
    experienceCount: cv.experience.length,
    gaps: [
      ...analysis.gaps,
      ...(input.job.missingRequirements ?? []),
      ...(input.job.concerns ?? []),
    ],
    grounding,
    marketConfirmed: input.marketConfirmed ?? true,
  });

  return {
    cv,
    letter,
    analysis,
    grounding,
    warnings,
    model: resolveModel("tailoredCvSlots"),
    promptVersion: [
      APPLICATION_ANALYSIS_PROMPT_VERSION,
      APPLICATION_CV_SLOTS_PROMPT_VERSION,
      APPLICATION_COVER_LETTER_PROMPT_VERSION,
    ].join("+"),
  };
}

type JobContext = {
  title: string;
  description: string;
  companyName: string;
  matchingReasons?: string[];
  concerns?: string[];
  missingRequirements?: string[];
};

async function runAnalysis(input: {
  profile: StructuredProfile;
  baseCv: TailoredCv;
  job: JobContext;
  companySummary?: string | null;
  market: PackageMarket;
}): Promise<PackageAnalysis & { summaryPatch?: string; skillOrder?: string[] }> {
  const system = loadPrompt("jobs/application-analysis.md");
  const user = JSON.stringify(
    {
      market: input.market,
      job: {
        title: input.job.title,
        companyName: input.job.companyName,
        description: input.job.description.slice(0, 6000),
        matchingReasons: input.job.matchingReasons ?? [],
        concerns: input.job.concerns ?? [],
        missingRequirements: input.job.missingRequirements ?? [],
      },
      companySummary: input.companySummary ?? null,
      profileDigest: {
        currentRole: input.profile.currentRole,
        seniority: input.profile.seniority,
        yearsExperience: input.profile.yearsExperience,
        strongestSkills: input.profile.strongestSkills,
        licenses: input.profile.licenses,
        certifications: input.profile.certifications,
        industries: input.profile.industries,
        achievements: input.profile.achievements.slice(0, 6),
        projects: input.baseCv.projects.map((p) => ({
          id: p.id,
          title: p.title,
          summary: p.summary,
          outcomes: p.outcomes,
        })),
        experience: input.baseCv.experience.map((e) => ({
          id: e.id,
          organization: e.organization,
          role: e.role,
          start: e.start,
          end: e.end,
          bullets: e.bullets,
        })),
      },
    },
    null,
    2,
  );

  try {
    const model = resolveModel("applicationAnalysis");
    const completion = await googleProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "applicationAnalysis",
      temperature: 0.2,
    });
    const parsed = AnalysisLlmSchema.parse(parseJsonLoose(completion.text));
    return parsed;
  } catch {
    // Deterministic fallback — still useful without LLM.
    return PackageAnalysisSchema.parse({
      roleSummary: `${input.job.title} at ${input.job.companyName}`,
      mustHaves: input.job.missingRequirements?.slice(0, 5) ?? [],
      fitStrengths: input.job.matchingReasons?.slice(0, 5) ?? [],
      gaps: input.job.concerns?.slice(0, 5) ?? [],
      recommendedSkillOrder: input.baseCv.skills.slice(0, 12),
      recommendedProjectIds: input.baseCv.projects.slice(0, 3).map((p) => p.id),
      recommendedBulletIds: [],
      suggestedMarket: input.market,
    });
  }
}

async function runCvSlotPatch(input: {
  baseCv: TailoredCv;
  analysis: PackageAnalysis;
  job: { title: string; companyName: string; description: string };
  market: PackageMarket;
  spellingHint: string;
}): Promise<z.infer<typeof CvSlotPatchSchema>> {
  const system = loadPrompt("jobs/tailored-cv-slots.md");
  const user = JSON.stringify(
    {
      market: input.market,
      spellingHint: input.spellingHint,
      job: {
        title: input.job.title,
        companyName: input.job.companyName,
        description: input.job.description.slice(0, 4000),
      },
      analysis: input.analysis,
      baseCv: {
        summary: input.baseCv.summary,
        skills: input.baseCv.skills,
        experience: input.baseCv.experience.map((e) => ({
          id: e.id,
          organization: e.organization,
          role: e.role,
          bullets: e.bullets,
        })),
        projects: input.baseCv.projects.map((p) => ({
          id: p.id,
          title: p.title,
          summary: p.summary,
          outcomes: p.outcomes,
        })),
      },
      rules: [
        "Only reorder/select existing skills — never invent new skills.",
        "Only use existing experience/project ids.",
        "Preserve employers and roles from baseCv — do not drop relevant work history.",
        "Prefer included:true; select/reorder bullets per role instead of excluding roles.",
        "You may lightly rephrase bullets but must not add employers, dates, or metrics.",
        "Summary max 3 sentences.",
      ],
    },
    null,
    2,
  );

  try {
    const model = resolveModel("tailoredCvSlots");
    const completion = await anthropicProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "tailoredCvSlots",
      temperature: 0.35,
      maxTokens: 2048,
    });
    return CvSlotPatchSchema.parse(parseJsonLoose(completion.text));
  } catch {
    return {
      summary: input.baseCv.summary,
      skills: input.analysis.recommendedSkillOrder.length
        ? input.analysis.recommendedSkillOrder
        : input.baseCv.skills,
      projects: input.analysis.recommendedProjectIds.map((id) => ({
        id,
        included: true,
      })),
    };
  }
}

async function runCoverLetter(input: {
  profile: StructuredProfile;
  cv: TailoredCv;
  job: { title: string; companyName: string; description: string };
  companySummary?: string | null;
  market: PackageMarket;
  spellingHint: string;
  fullName: string;
}): Promise<CoverLetter> {
  const system = loadPrompt("jobs/cover-letter.md");
  const experienceProof = input.cv.experience
    .filter((e) => e.included)
    .slice(0, 4)
    .map((e) => ({
      role: e.role,
      organization: e.organization,
      dates: [e.start, e.end].filter(Boolean).join(" – ") || undefined,
      bullets: e.bullets.slice(0, 3),
    }));

  const projectProof = input.cv.projects
    .filter((p) => p.included)
    .slice(0, 2)
    .map((p) => ({
      title: p.title,
      summary: p.summary,
      outcomes: p.outcomes.slice(0, 2),
    }));

  const proofPoints = [
    ...experienceProof.flatMap((e) =>
      e.bullets.map((b) => `${e.role} at ${e.organization}: ${b}`),
    ),
    ...projectProof.flatMap((p) =>
      (p.outcomes.length ? p.outcomes : p.summary ? [p.summary] : []).map(
        (o) => `${p.title}: ${o}`,
      ),
    ),
  ].slice(0, 6);

  const user = JSON.stringify(
    {
      market: input.market,
      spellingHint: input.spellingHint,
      outputLanguage: input.cv.outputLanguage,
      occupationFamily: resolveFamily(input.profile),
      fullName: input.fullName,
      job: {
        title: input.job.title,
        companyName: input.job.companyName,
        description: input.job.description.slice(0, 3500),
      },
      companySummary: input.companySummary ?? null,
      candidate: {
        headline: input.cv.headline,
        summary: input.cv.summary,
        skills: input.cv.skills.slice(0, 8),
        experience: experienceProof,
        projects: projectProof,
        proofPoints,
      },
      rules: [
        "150–220 words total across opening, body, closing.",
        "Name the company and role in the opening with a specific fit reason.",
        "Body must cite 1–2 concrete proof points with role + organization.",
        "No generic AI enthusiasm. No inventing experience.",
        "Do not repeat the full CV.",
        "Return JSON only.",
      ],
    },
    null,
    2,
  );

  try {
    const model = resolveModel("applicationCoverLetter");
    const completion = await anthropicProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "applicationCoverLetter",
      temperature: 0.45,
      maxTokens: 1024,
    });
    const parsed = parseJsonLoose(completion.text);
    const obj =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    return CoverLetterSchema.parse({
      ...obj,
      fullName: input.fullName,
    });
  } catch {
    const primary = experienceProof[0];
    if (input.cv.outputLanguage === "sr") {
      return CoverLetterSchema.parse({
        greeting: "Poštovani,",
        opening: `Prijavljujem se za poziciju ${input.job.title} u kompaniji ${input.job.companyName}.`,
        body:
          primary && primary.bullets[0]
            ? `Kao ${primary.role} u ${primary.organization}: ${primary.bullets[0]}`
            : input.cv.summary.slice(0, 280),
        closing: "Hvala na razmatranju prijave. Rado ću doći na razgovor.",
        signOff: "Srdačan pozdrav,",
        fullName: input.fullName,
      });
    }
    const proof =
      primary && primary.bullets[0]
        ? `In my work as ${primary.role} at ${primary.organization}, ${primary.bullets[0].replace(/^[A-Z]/, (c) => c.toLowerCase())}`
        : proofPoints[0] ||
          input.cv.summary.slice(0, 280) ||
          "I would welcome the chance to contribute.";
    return CoverLetterSchema.parse({
      greeting: "Dear Hiring Team,",
      opening: `I am writing to apply for the ${input.job.title} role at ${input.job.companyName}. My background as ${input.cv.headline || input.profile.currentRole || "an experienced professional"} aligns closely with what you are hiring for.`,
      body: proof,
      closing:
        "Thank you for your consideration. I would welcome a conversation about how I can help.",
      signOff: input.market === "europe" ? "Kind regards," : "Best regards,",
      fullName: input.fullName,
    });
  }
}

export async function regenerateCvSummary(input: {
  profile: StructuredProfile;
  cv: TailoredCv;
  job: { title: string; companyName: string; description: string };
  market: PackageMarket;
}): Promise<string> {
  const labels = marketLabels(input.market, input.cv.outputLanguage, input.cv.template);
  const patch = await runCvSlotPatch({
    baseCv: input.cv,
    analysis: PackageAnalysisSchema.parse({
      roleSummary: input.job.title,
      recommendedSkillOrder: input.cv.skills,
      recommendedProjectIds: input.cv.projects
        .filter((p) => p.included)
        .map((p) => p.id),
    }),
    job: input.job,
    market: input.market,
    spellingHint: labels.spellingHint,
  });
  return patch.summary?.trim() || input.cv.summary;
}

export async function regenerateCoverLetter(input: {
  profile: StructuredProfile;
  cv: TailoredCv;
  job: { title: string; companyName: string; description: string };
  companySummary?: string | null;
  market: PackageMarket;
  fullName: string;
}): Promise<CoverLetter> {
  const labels = marketLabels(input.market, input.cv.outputLanguage, input.cv.template);
  return runCoverLetter({
    ...input,
    spellingHint: labels.spellingHint,
  });
}
