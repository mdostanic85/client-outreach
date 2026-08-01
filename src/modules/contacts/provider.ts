/**
 * Optional verified-provider adapter — stub only.
 * Wire a real provider later for accepted high-value leads.
 * Never invent addresses; never auto-send unverified results.
 */

export type ProviderContactResult = {
  email: string;
  name: string | null;
  role: string | null;
  provider: string;
  verified: boolean;
};

export type ContactProvider = {
  id: string;
  lookup(input: {
    domain: string;
    fullName?: string;
    role?: string;
  }): Promise<ProviderContactResult[]>;
};

/** Placeholder — returns empty until a provider is configured. */
export const nullContactProvider: ContactProvider = {
  id: "none",
  async lookup() {
    return [];
  },
};

export async function lookupViaProvider(
  provider: ContactProvider,
  input: { domain: string; fullName?: string; role?: string },
): Promise<ProviderContactResult[]> {
  if (provider.id === "none") return [];
  return provider.lookup(input);
}
