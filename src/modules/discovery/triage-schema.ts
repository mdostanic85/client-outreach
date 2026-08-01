import { z } from "zod";

export const TriageResultSchema = z.object({
  companyKey: z.string().min(1),
  keep: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  unknowns: z.array(z.string()),
});

export const TriageBatchSchema = z.array(TriageResultSchema);

export type TriageResult = z.infer<typeof TriageResultSchema>;
