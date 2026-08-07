# Prompt: Audit existing LLMs, then add Google Gemini

Copy everything inside the block below into the other app’s agent chat.

---

```text
You are working in this codebase. Follow these two phases in order. Do not start Phase 2 until Phase 1 is complete and you have summarized findings.

## Goal

1. Audit how this app currently uses LLMs / AI providers.
2. Add Google Gemini (Generative Language API, REST) for cheap PUBLIC workloads, using the same pattern as a reference app (Optra).

Do NOT add Anthropic/Claude in this task. Gemini only.

Default model: `gemini-3.1-flash-lite`
Env secret: `GOOGLE_API_KEY`
Optional model override: `PUBLIC_LLM_MODEL`

---

## Phase 1 — LLM audit (read-only first)

Search the repo for every AI / LLM integration. Report:

### Inventory
- Providers in use (OpenAI, Anthropic, Google, Vercel AI Gateway, Azure, local, etc.)
- Packages / SDKs (`ai`, `@ai-sdk/*`, `openai`, `@anthropic-ai/sdk`, raw `fetch`, etc.)
- Env vars that hold API keys or model names
- Default / configured model IDs
- Where calls happen (file paths + brief purpose)

### Architecture
- Is there a central router / provider abstraction, or ad-hoc calls?
- Streaming vs non-streaming
- JSON-mode / structured output usage
- Usage / cost logging, if any
- Any PUBLIC vs PRIVATE / PII split already?

### Recommendation
Based on the audit, propose:
- Where Gemini should live (new module vs extend existing client)
- Which existing call sites (if any) should stay on their current provider
- Which NEW or PUBLIC/bulk tasks are good Gemini candidates
- What NOT to move to Gemini (PII, personal docs, email drafts, auth data)

Write a short audit summary before coding.

---

## Phase 2 — Add Gemini

Implement a thin Google Gemini REST client (no need for Google’s official SDK unless the repo already standardizes on it).

### API contract

Endpoint:
`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GOOGLE_API_KEY}`

Request shape:
- Map chat roles: `user` → `user`, `assistant` → `model`
- Put `system` content in `systemInstruction.parts[].text` (do not put system in `contents`)
- `generationConfig.temperature` (default ~0.2 for deterministic public tasks)
- Optional JSON mode: `generationConfig.responseMimeType = "application/json"`

Response:
- Concatenate `candidates[0].content.parts[].text`
- Throw if empty
- Prefer reading `usageMetadata.promptTokenCount` / `candidatesTokenCount` if the app tracks usage

### Config

Add to `.env.example` (and document):

```
# Public research / cheap bulk LLM (Gemini)
GOOGLE_API_KEY=
# Optional override (default: gemini-3.1-flash-lite)
# PUBLIC_LLM_MODEL=gemini-3.1-flash-lite
```

Resolve model as: `process.env.PUBLIC_LLM_MODEL ?? "gemini-3.1-flash-lite"`

### Integration rules

1. Fit the existing AI patterns in this repo (same message types, error style, logging).
2. Wire Gemini behind whatever provider interface already exists; if none exists, add a small `LlmProvider`-style `complete()` helper.
3. Use Gemini only for PUBLIC / non-sensitive workloads (triage, scoring, structured extraction from public job/company text, cheap classification of non-PII content).
4. Do not send CVs, mailbox content, passwords, or other personal data to Gemini.
5. If the app already has an LLM for the same task, do not blindly replace it — add Gemini as the public/cheap path and keep private writing on the existing provider unless the audit clearly says otherwise.
6. Add or update a minimal smoke test / eval if the repo has an AI test pattern; otherwise a tiny unit test that mocks `fetch` is enough.
7. Keep the change focused: no unrelated refactors.

### Reference implementation shape (adapt to this repo)

```ts
// Pseudocode — match local types and secrets helpers
async function geminiComplete({ model, messages, temperature = 0.2, jsonMode }) {
  const apiKey = requireEnv("GOOGLE_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const system = messages.find((m) => m.role === "system")?.content;
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body = {
    contents,
    generationConfig: {
      temperature,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google LLM error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Google LLM returned empty response");
  return { text, usage: data.usageMetadata };
}
```

---

## Deliverables

1. Phase 1 audit summary (providers, models, files, recommendation)
2. Working Gemini client + env docs
3. At least one real call path using Gemini for a PUBLIC task (or a clearly marked stub if no suitable call site exists yet — prefer a real path)
4. Brief note in README or ops docs: how to get a key from https://aistudio.google.com/apikey

Start with Phase 1 now.
```

---

## Notes (for you, not part of the prompt)

- Optra defaults: `gemini-3.1-flash-lite` via `GOOGLE_API_KEY` / optional `PUBLIC_LLM_MODEL`.
- Reference code in this repo: `src/lib/ai/google.ts`, `src/lib/ai/routing.ts`.
- Key: [Google AI Studio](https://aistudio.google.com/apikey).
