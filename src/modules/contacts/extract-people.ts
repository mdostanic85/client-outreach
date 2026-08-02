import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activities, companies, leads } from "@/db/schema";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import { loadPrompt } from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";

const PeopleSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(20),
});

export type ExtractedPerson = {
  name: string;
  role: string | null;
  confidence: number;
};

/**
 * Extract names/roles from public team page text.
 * Does NOT invent email addresses.
 */
export async function extractPeopleFromTeamText(input: {
  leadId: string;
  pageUrl: string;
  pageText: string;
  recommendedRole?: string | null;
}): Promise<ExtractedPerson[]> {
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");

  const company = (await db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId)).limit(1))[0];

  const system = loadPrompt("contacts/extract-people.md");
  const user = JSON.stringify(
    {
      companyName: company?.name,
      pageUrl: input.pageUrl,
      recommendedRole: input.recommendedRole ?? null,
      pageText: input.pageText.slice(0, 15_000),
    },
    null,
    2,
  );

  const model = resolveModel("extractPeople");
  const completion = await googleProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "extractPeople",
    temperature: 0.1,
    jsonMode: true,
  });

  let parsed: z.infer<typeof PeopleSchema>;
  try {
    const trimmed = completion.text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    parsed = PeopleSchema.parse(
      JSON.parse(fenced ? fenced[1]!.trim() : trimmed),
    );
  } catch (err) {
    logger.warn({ err, leadId: input.leadId }, "extractPeople parse failed");
    return [];
  }

  const people: ExtractedPerson[] = parsed.people.map((p) => ({
    name: p.name.trim(),
    role: p.role?.trim() || null,
    confidence: p.confidence ?? 0.5,
  }));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId: input.leadId,
      type: "people_extracted",
      metadataJson: JSON.stringify({
        pageUrl: input.pageUrl,
        count: people.length,
        people: people.slice(0, 10),
      }),
      occurredAt: nowIso(),
    });

  return people;
}
