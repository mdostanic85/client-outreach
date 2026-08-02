import { requireSecret } from "@/lib/security/secrets";
import { logger } from "@/lib/logging/logger";
import { recordUsage, type ChatMessage, type LlmCompletion, type LlmProvider } from "./types";

/**
 * Google Gemini via Generative Language API (REST).
 * Used for PUBLIC workloads only.
 */
export const googleProvider: LlmProvider = {
  async complete({ model, messages, task, temperature = 0.2, jsonMode }) {
    const apiKey = requireSecret("GOOGLE_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const system = messages.find((m) => m.role === "system")?.content;
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error({ status: res.status, task }, "Google LLM request failed");
      throw new Error(`Google LLM error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) {
      throw new Error("Google LLM returned empty response");
    }

    const usage = {
      provider: "google",
      model,
      task,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
    const estimatedCost = await recordUsage(usage);

    return { text, usage, estimatedCost } satisfies LlmCompletion;
  },
};

export function buildMessages(
  system: string,
  user: string,
): ChatMessage[] {
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
