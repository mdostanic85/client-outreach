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

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(inc|llc|ltd|gmbh|ag|sa|bv|plc|corp|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function extractDomain(urlOrHost?: string | null): string | undefined {
  if (!urlOrHost) return undefined;
  try {
    const withProtocol = urlOrHost.includes("://")
      ? urlOrHost
      : `https://${urlOrHost}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
