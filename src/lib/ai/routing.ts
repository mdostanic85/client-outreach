export type DataClass = "PUBLIC" | "PRIVATE";

export const TASK_ROUTES = {
  triage: {
    dataClass: "PUBLIC" as const,
    provider: "google" as const,
    modelEnv: "PUBLIC_LLM_MODEL",
    defaultModel: "gemini-3.1-flash-lite",
  },
  researchAndScore: {
    dataClass: "PUBLIC" as const,
    provider: "google" as const,
    modelEnv: "PUBLIC_LLM_MODEL",
    defaultModel: "gemini-3.1-flash-lite",
  },
  extractPeople: {
    dataClass: "PUBLIC" as const,
    provider: "google" as const,
    modelEnv: "PUBLIC_LLM_MODEL",
    defaultModel: "gemini-3.1-flash-lite",
  },
  draftMessage: {
    dataClass: "PRIVATE" as const,
    provider: "anthropic" as const,
    modelEnv: "PRIVATE_WRITING_MODEL",
    defaultModel: "claude-sonnet-4-5",
  },
  classifyReply: {
    dataClass: "PRIVATE" as const,
    provider: "anthropic" as const,
    modelEnv: "PRIVATE_CLASSIFY_MODEL",
    defaultModel: "claude-haiku-4-5",
  },
  styleProposal: {
    dataClass: "PRIVATE" as const,
    provider: "anthropic" as const,
    modelEnv: "PRIVATE_WRITING_MODEL",
    defaultModel: "claude-sonnet-4-5",
  },
  marketReport: {
    dataClass: "PRIVATE" as const,
    provider: "anthropic" as const,
    modelEnv: "PRIVATE_WRITING_MODEL",
    defaultModel: "claude-sonnet-4-5",
  },
  positioningRecs: {
    dataClass: "PRIVATE" as const,
    provider: "anthropic" as const,
    modelEnv: "PRIVATE_WRITING_MODEL",
    defaultModel: "claude-sonnet-4-5",
  },
  /** CV / profile extract — private-first (sensitive personal data). */
  profileExtract: {
    dataClass: "PRIVATE" as const,
    provider: "anthropic" as const,
    modelEnv: "PRIVATE_WRITING_MODEL",
    defaultModel: "claude-sonnet-4-5",
  },
  /** Search criteria from structured profile — public mid-tier OK. */
  jobSearchProfile: {
    dataClass: "PUBLIC" as const,
    provider: "google" as const,
    modelEnv: "PUBLIC_LLM_MODEL",
    defaultModel: "gemini-3.1-flash-lite",
  },
  /** Job-vs-profile evaluate — cheap public, survivors only. */
  jobMatch: {
    dataClass: "PUBLIC" as const,
    provider: "google" as const,
    modelEnv: "PUBLIC_LLM_MODEL",
    defaultModel: "gemini-3.1-flash-lite",
  },
} as const;

export type TaskName = keyof typeof TASK_ROUTES;

/** Approximate USD per 1M tokens (input/output). Recheck periodically. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 1, output: 5 };
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export function resolveModel(task: TaskName): string {
  const route = TASK_ROUTES[task];
  return process.env[route.modelEnv] ?? route.defaultModel;
}
