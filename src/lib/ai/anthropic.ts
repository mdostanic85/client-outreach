import { requireSecret } from "@/lib/security/secrets";
import { logger } from "@/lib/logging/logger";
import { recordUsage, type LlmCompletion, type LlmProvider } from "./types";

/**
 * Anthropic Claude via Messages API (REST).
 * Used for PRIVATE writing workloads only.
 */
export const anthropicProvider: LlmProvider = {
  async complete({ model, messages, task, temperature = 0.4, maxTokens = 1024 }) {
    const apiKey = requireSecret("ANTHROPIC_API_KEY");
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const apiMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: apiMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error({ status: res.status, task }, "Anthropic LLM request failed");
      throw new Error(`Anthropic LLM error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text =
      data.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("") ?? "";

    if (!text) {
      throw new Error("Anthropic LLM returned empty response");
    }

    const usage = {
      provider: "anthropic",
      model,
      task,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
    const estimatedCost = recordUsage(usage);

    return { text, usage, estimatedCost } satisfies LlmCompletion;
  },
};
