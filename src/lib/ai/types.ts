import { getDb } from "@/db/client";
import { apiUsage } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { estimateCost } from "./routing";

export type LlmUsage = {
  provider: string;
  model: string;
  task: string;
  inputTokens: number;
  outputTokens: number;
};

export type LlmCompletion = {
  text: string;
  usage: LlmUsage;
  estimatedCost: number;
};

export function recordUsage(usage: LlmUsage): number {
  const cost = estimateCost(usage.model, usage.inputTokens, usage.outputTokens);
  getDb()
    .insert(apiUsage)
    .values({
      id: newId("usage"),
      provider: usage.provider,
      model: usage.model,
      task: usage.task,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCost: cost,
      occurredAt: nowIso(),
    })
    .run();
  return cost;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface LlmProvider {
  complete(args: {
    model: string;
    messages: ChatMessage[];
    task: string;
    temperature?: number;
    jsonMode?: boolean;
    maxTokens?: number;
  }): Promise<LlmCompletion>;
}
