import { createHash } from "node:crypto";
import { z } from "zod";

export const DiscoverySignalSchema = z.object({
  source: z.enum(["remotive", "arbeitnow", "manual"]),
  externalId: z.string().min(1),
  companyName: z.string().min(1),
  companyDomain: z.string().optional(),
  title: z.string().min(1),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  publishedAt: z.string().optional(),
  sourceUrl: z.string().min(1),
  rawHash: z.string().min(1),
});

export type DiscoverySignal = z.infer<typeof DiscoverySignalSchema>;

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
