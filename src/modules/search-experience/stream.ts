/**
 * Find jobs / Find companies stream NDJSON from their Route Handlers: one
 * JSON event per line, ending in `done` or `error`. This module is the
 * shared contract for both ends, and the browser-side reader.
 */

export type SearchStreamEvent<Progress, Stats> =
  | { type: "progress"; progress: Progress }
  | { type: "done"; stats: Stats }
  | { type: "error"; error: string };

/**
 * POSTs to a search route and calls `onEvent` for each event as it arrives.
 * Malformed lines are skipped; an `error` event or a failed response throws.
 * Resolves with the final stats, or null when the stream ended without `done`.
 */
export async function readSearchStream<Progress, Stats>(
  url: string,
  options: {
    signal: AbortSignal;
    onProgress: (progress: Progress) => void;
  },
): Promise<Stats | null> {
  const res = await fetch(url, {
    method: "POST",
    signal: options.signal,
    headers: { Accept: "application/x-ndjson" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200) || `Search failed (${res.status})`);
  }
  if (!res.body) throw new Error("No progress stream from server");

  let finalStats: Stats | null = null;
  const takeLine = (line: string) => {
    if (!line.trim()) return;
    let event: SearchStreamEvent<Progress, Stats>;
    try {
      event = JSON.parse(line) as SearchStreamEvent<Progress, Stats>;
    } catch {
      return;
    }
    if (event.type === "progress") options.onProgress(event.progress);
    else if (event.type === "done") finalStats = event.stats;
    else throw new Error(event.error);
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) takeLine(line);
  }
  buffer += decoder.decode();
  takeLine(buffer);
  return finalStats;
}

const NETWORK_ERROR_PATTERN =
  /failed to fetch|network\s*error|networkerror|load failed|err_internet_disconnected|err_network|err_connection|net::err/i;

/**
 * A search failure the user can act on. A dropped connection (tab sleep,
 * offline, proxy) or a network failure relayed from an upstream call is not a
 * pipeline bug, so the raw message is not shown. Relayed errors arrive as plain
 * `Error`s, so this must not require `TypeError`.
 */
export function describeSearchError(
  err: unknown,
  labels: { cancelled: string; retry: string; failed: string },
): string {
  if (err instanceof DOMException && err.name === "AbortError") return labels.cancelled;
  if (err instanceof Error && NETWORK_ERROR_PATTERN.test(err.message)) {
    return `Connection lost during search. ${labels.retry}`;
  }
  if (err instanceof Error && err.message.trim()) return err.message.slice(0, 400);
  return labels.failed;
}
