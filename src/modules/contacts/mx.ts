import { resolveMx } from "node:dns/promises";

/**
 * MX proves the domain can receive mail — NOT that a guessed mailbox exists.
 */
export async function checkDomainMx(domain: string): Promise<{
  ok: boolean;
  hosts: string[];
  error?: string;
}> {
  const host = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .toLowerCase();

  if (!host || !host.includes(".")) {
    return { ok: false, hosts: [], error: "Invalid domain" };
  }

  try {
    const records = await resolveMx(host);
    const hosts = records
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange);
    return { ok: hosts.length > 0, hosts };
  } catch (err) {
    return {
      ok: false,
      hosts: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
