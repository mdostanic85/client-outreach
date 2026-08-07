import { revalidatePath } from "next/cache";
import { ensureDb } from "@/db/ensure";
import { getSessionUser } from "@/modules/auth/session";
import type { CompanySearchProgress } from "@/modules/companies/progress";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type CompanyPipelineStats = {
  published?: number;
  rawCandidates?: number;
  deterministicallyRemoved?: number;
  triageRejected?: number;
  researched?: number;
  sourceErrors?: unknown[];
  skipped?: string;
};

type StreamEvent =
  | { type: "progress"; progress: CompanySearchProgress }
  | { type: "done"; stats: CompanyPipelineStats }
  | { type: "error"; error: string };

/**
 * Streams NDJSON progress while the company discovery pipeline runs.
 * Skips nested job discovery so Find Companies stays focused.
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
