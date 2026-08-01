import { extractDomain, hashPayload, DiscoverySignalSchema, type DiscoverySignal } from "./types";

/**
 * Manual company URL submission — highest-precision discovery source.
 */
export function createManualSignal(input: {
  companyName: string;
  companyUrl: string;
  title?: string;
  location?: string;
}): DiscoverySignal {
  const domain = extractDomain(input.companyUrl);
  if (!domain) {
    throw new Error("Invalid company URL — could not extract domain");
  }

  const externalId = `manual:${domain}`;
  const parsed = DiscoverySignalSchema.parse({
    source: "manual" as const,
    externalId,
    companyName: input.companyName.trim(),
    companyDomain: domain,
    title: input.title?.trim() || `Manual review: ${input.companyName.trim()}`,
    location: input.location,
    sourceUrl: input.companyUrl.includes("://")
      ? input.companyUrl
      : `https://${input.companyUrl}`,
    rawHash: hashPayload({
      domain,
      name: input.companyName.trim(),
      url: input.companyUrl,
    }),
  });

  return parsed;
}
