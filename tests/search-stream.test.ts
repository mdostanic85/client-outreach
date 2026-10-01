import assert from "node:assert/strict";
import test from "node:test";
import { describeSearchError, readSearchStream } from "../src/modules/search-experience/stream";

function streamResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status });
}

async function withResponse<T>(response: Response, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => response) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

const signal = new AbortController().signal;

test("events split across chunks are read in order; bad lines are skipped", async () => {
  const seen: number[] = [];
  const stats = await withResponse(
    streamResponse([
      '{"type":"progress","progress":{"percent":10}}\n{"type":"pro',
      'gress","progress":{"percent":50}}\nnot json\n',
      '{"type":"done","stats":{"published":3}}',
    ]),
    () =>
      readSearchStream<{ percent: number }, { published: number }>("/api/jobs/search", {
        signal,
        onProgress: (p) => seen.push(p.percent),
      }),
  );
  assert.deepEqual(seen, [10, 50]);
  assert.deepEqual(stats, { published: 3 }, "a final line without newline still counts");
});

test("an error event or a failed response throws", async () => {
  await assert.rejects(
    withResponse(streamResponse(['{"type":"error","error":"Budget reached"}\n']), () =>
      readSearchStream("/x", { signal, onProgress: () => {} }),
    ),
    /Budget reached/,
  );
  await assert.rejects(
    withResponse(new Response("Only the workspace owner can do this.", { status: 403 }), () =>
      readSearchStream("/x", { signal, onProgress: () => {} }),
    ),
    /workspace owner/,
  );
});

test("a stream that ends without done resolves to null", async () => {
  const stats = await withResponse(streamResponse(['{"type":"progress","progress":{}}\n']), () =>
    readSearchStream("/x", { signal, onProgress: () => {} }),
  );
  assert.equal(stats, null);
});

test("network failures get a retry hint instead of the raw message", () => {
  const labels = { cancelled: "Cancelled.", retry: "Try again.", failed: "Failed." };
  assert.equal(describeSearchError(new TypeError("Failed to fetch"), labels), "Connection lost during search. Try again.");
  assert.equal(describeSearchError(new Error("No approved profile"), labels), "No approved profile");
  assert.equal(describeSearchError(new DOMException("x", "AbortError"), labels), "Cancelled.");
  assert.equal(describeSearchError("??", labels), "Failed.");
});
