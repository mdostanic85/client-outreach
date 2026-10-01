import { revalidatePath } from "next/cache";
import { ensureDb } from "@/db/ensure";
import { logger } from "@/lib/logging/logger";
import { getRequestUser } from "@/modules/auth/page-guards";
import type { CompanyPipelineStats, CompanySearchProgress } from "@/modules/companies/progress";
import type { SearchStreamEvent } from "@/modules/search-experience/stream";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type StreamEvent = SearchStreamEvent<CompanySearchProgress, CompanyPipelineStats>;

/**
 * Streams NDJSON progress while the company discovery pipeline runs.
 * Skips nested job discovery so Find Companies stays focused.
 */
function errorResponse(status: number, error: string) {
  return new Response(JSON.stringify({ type: "error", error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Client outreach is owner-only, like every company action. */
export async function POST() {
  await ensureDb();
  const caller = await getRequestUser();
  if (!caller) return errorResponse(401, "Unauthorized");
  if (!caller.owner) return errorResponse(403, "Only the workspace owner can do this.");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const { runWorkerPipeline } = await import(
          "@/modules/tracking/worker"
        );
        const result = await runWorkerPipeline({
          skipJobs: true,
          onProgress: async (progress) => {
            send({ type: "progress", progress });
          },
        });

        const stats = result.stats as CompanyPipelineStats;
        revalidatePath("/");
        send({
          type: "done",
          stats: {
            published: Number(stats.published ?? 0),
            rawCandidates: Number(stats.rawCandidates ?? 0) || undefined,
            deterministicallyRemoved:
              Number(stats.deterministicallyRemoved ?? 0) || undefined,
            triageRejected: Number(stats.triageRejected ?? 0) || undefined,
            researched: Number(stats.researched ?? 0) || undefined,
            sourceErrors: Array.isArray(stats.sourceErrors)
              ? stats.sourceErrors
              : undefined,
          },
        });
      } catch (err) {
        logger.warn({ err }, "company search failed");
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
