import { revalidatePath } from "next/cache";
import { ensureDb } from "@/db/ensure";
import { logger } from "@/lib/logging/logger";
import { getSessionUser } from "@/modules/auth/session";
import type { JobSearchProgress } from "@/modules/jobs/progress";
import type { JobPipelineStats } from "@/modules/jobs/pipeline";
import type { SearchStreamEvent } from "@/modules/search-experience/stream";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type StreamEvent = SearchStreamEvent<JobSearchProgress, JobPipelineStats>;

/**
 * Streams NDJSON progress while the job discovery pipeline runs.
 * Client reads line-by-line for live % + current step detail.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ type: "error", error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await ensureDb();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser already left. Keep collecting and publishing.
        }
      };

      try {
        const { runJobDiscoveryPipeline } = await import(
          "@/modules/jobs/pipeline"
        );
        const stats = await runJobDiscoveryPipeline({
          onProgress: async (progress) => {
            send({ type: "progress", progress });
          },
        });
        revalidatePath("/");
        send({ type: "done", stats });
      } catch (err) {
        logger.warn({ err }, "job search failed");
        send({
          type: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
