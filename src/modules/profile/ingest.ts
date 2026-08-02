import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { retrievePage } from "@/lib/retrieval/fetch-page";
import { logger } from "@/lib/logging/logger";
import type { ProfileSourceType } from "./schemas";

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function sourcesDir(): string {
  const dir = path.join(process.cwd(), "data", "profile-sources");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default as (
    data: Buffer,
  ) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return (result.text ?? "").trim();
}

function findActiveByHash(contentHash: string) {
  return getDb()
    .select()
    .from(profileSources)
    .where(
      and(
        eq(profileSources.contentHash, contentHash),
        isNull(profileSources.deletedAt),
      ),
    )
    .get();
}

export async function ingestTextSource(input: {
  type: ProfileSourceType;
  text: string;
  label?: string;
  sourceUrl?: string;
}): Promise<{ id: string; reused: boolean }> {
  const rawText = input.text.trim();
  if (!rawText) throw new Error("Source text is empty");

  const contentHash = hashContent(`${input.type}:${rawText}`);
  const db = getDb();
  const existing = findActiveByHash(contentHash);
  if (existing) {
    const syncedAt = nowIso();
    db.update(profileSources)
      .set({ lastSyncedAt: syncedAt })
      .where(eq(profileSources.id, existing.id))
      .run();
    return { id: existing.id, reused: true };
  }

  const id = newId("psrc");
  const syncedAt = nowIso();
  db.insert(profileSources)
    .values({
      id,
      type: input.type,
      label: input.label ?? null,
      rawText,
      filePath: null,
      sourceUrl: input.sourceUrl ?? null,
      contentHash,
      ingestedAt: syncedAt,
      lastSyncedAt: syncedAt,
      enabledForMatching: 1,
      deletedAt: null,
    })
    .run();

  logger.info({ id, type: input.type }, "profile source ingested");
  return { id, reused: false };
}

const FILE_SOURCE_TYPES = ["cv", "linkedin_text", "document"] as const;
export type FileProfileSourceType = (typeof FILE_SOURCE_TYPES)[number];

export function isFileProfileSourceType(
  value: string,
): value is FileProfileSourceType {
  return (FILE_SOURCE_TYPES as readonly string[]).includes(value);
}

/** Upload CV, LinkedIn Save-to-PDF, or other document (PDF / txt / md). */
export async function ingestFileUpload(input: {
  filename: string;
  bytes: Buffer;
  type?: FileProfileSourceType;
  label?: string;
}): Promise<{ id: string; reused: boolean; textLength: number }> {
  const type: FileProfileSourceType = input.type ?? "cv";
  const lower = input.filename.toLowerCase();
  let rawText: string;
  let filePath: string | null = null;

  if (lower.endsWith(".pdf")) {
    rawText = await extractPdfText(input.bytes);
    if (!rawText) throw new Error("Could not extract text from PDF");
    const id = newId("psrc");
    const dest = path.join(sourcesDir(), `${id}.pdf`);
    fs.writeFileSync(dest, input.bytes);
    filePath = dest;

    const contentHash = hashContent(`${type}:${rawText}`);
    const db = getDb();
    const existing = findActiveByHash(contentHash);
    if (existing) {
      fs.unlinkSync(dest);
      const syncedAt = nowIso();
      db.update(profileSources)
        .set({ lastSyncedAt: syncedAt })
        .where(eq(profileSources.id, existing.id))
        .run();
      return {
        id: existing.id,
        reused: true,
        textLength: existing.rawText?.length ?? 0,
      };
    }

    const syncedAt = nowIso();
    db.insert(profileSources)
      .values({
        id,
        type,
        label: input.label ?? input.filename,
        rawText,
        filePath,
        sourceUrl: null,
        contentHash,
        ingestedAt: syncedAt,
        lastSyncedAt: syncedAt,
        enabledForMatching: 1,
        deletedAt: null,
      })
      .run();

    logger.info({ id, type, textLength: rawText.length }, "profile PDF ingested");
    return { id, reused: false, textLength: rawText.length };
  }

  rawText = input.bytes.toString("utf8").trim();
  const result = await ingestTextSource({
    type,
    text: rawText,
    label: input.label ?? input.filename,
  });
  return { ...result, textLength: rawText.length };
}

/** @deprecated Prefer ingestFileUpload — kept for existing callers. */
export async function ingestCvUpload(input: {
  filename: string;
  bytes: Buffer;
  label?: string;
}): Promise<{ id: string; reused: boolean; textLength: number }> {
  return ingestFileUpload({ ...input, type: "cv" });
}

export async function ingestPortfolioUrl(
  url: string,
): Promise<{ id: string; reused: boolean; textLength: number }> {
  const page = await retrievePage(url);
  if (page.status !== "ok" || !page.extractedText?.trim()) {
    throw new Error(page.error ?? "Failed to fetch portfolio page");
  }
  const result = await ingestTextSource({
    type: "portfolio_url",
    text: page.extractedText,
    label: page.title ?? url,
    sourceUrl: page.finalUrl || url,
  });
  return {
    ...result,
    textLength: page.extractedText.length,
  };
}

/** Refresh an existing portfolio/GitHub source without deleting knowledge. */
export async function refreshProfileSource(
  id: string,
): Promise<{ id: string; textLength: number }> {
  const db = getDb();
  const row = db
    .select()
    .from(profileSources)
    .where(and(eq(profileSources.id, id), isNull(profileSources.deletedAt)))
    .get();
  if (!row) throw new Error("Source not found");

  if (row.type === "portfolio_url") {
    if (!row.sourceUrl) throw new Error("Portfolio source has no URL to refresh");
    const page = await retrievePage(row.sourceUrl);
    if (page.status !== "ok" || !page.extractedText?.trim()) {
      throw new Error(page.error ?? "Failed to refresh portfolio page");
    }
    const syncedAt = nowIso();
    db.update(profileSources)
      .set({
        rawText: page.extractedText,
        label: page.title ?? row.label,
        contentHash: hashContent(`portfolio_url:${page.extractedText}`),
        lastSyncedAt: syncedAt,
      })
      .where(eq(profileSources.id, id))
      .run();
    return { id, textLength: page.extractedText.length };
  }

  if (row.type === "github") {
    const { fetchGithubProfileCorpus } = await import("./github");
    const handle =
      row.sourceUrl?.replace(/^https?:\/\/github\.com\//, "") ??
      row.label?.replace(/^GitHub @/, "") ??
      "";
    if (!handle) throw new Error("GitHub source has no username to refresh");
    const corpus = await fetchGithubProfileCorpus(handle);
    const syncedAt = nowIso();
    db.update(profileSources)
      .set({
        rawText: corpus.text,
        label: `GitHub @${corpus.username}`,
        sourceUrl: corpus.sourceUrl,
        contentHash: hashContent(`github:${corpus.text}`),
        lastSyncedAt: syncedAt,
      })
      .where(eq(profileSources.id, id))
      .run();
    return { id, textLength: corpus.text.length };
  }

  throw new Error("Only portfolio websites and GitHub can be refreshed");
}

export async function ingestGithubProfile(
  usernameOrUrl: string,
): Promise<{ id: string; reused: boolean; textLength: number }> {
  const { fetchGithubProfileCorpus } = await import("./github");
  const corpus = await fetchGithubProfileCorpus(usernameOrUrl);
  const result = await ingestTextSource({
    type: "github",
    text: corpus.text,
    label: `GitHub @${corpus.username}`,
    sourceUrl: corpus.sourceUrl,
  });
  return {
    ...result,
    textLength: corpus.text.length,
  };
}

export function setProfileSourceMatchingEnabled(
  id: string,
  enabled: boolean,
): void {
  const db = getDb();
  const row = db
    .select()
    .from(profileSources)
    .where(and(eq(profileSources.id, id), isNull(profileSources.deletedAt)))
    .get();
  if (!row) throw new Error("Source not found");
  db.update(profileSources)
    .set({ enabledForMatching: enabled ? 1 : 0 })
    .where(eq(profileSources.id, id))
    .run();
}

/**
 * Soft-delete a source. Does not mutate structured profile JSON.
 * Requires an explicit user confirmation in the UI.
 */
export function softDeleteProfileSource(id: string): void {
  const db = getDb();
  const row = db
    .select()
    .from(profileSources)
    .where(and(eq(profileSources.id, id), isNull(profileSources.deletedAt)))
    .get();
  if (!row) return;
  db.update(profileSources)
    .set({
      deletedAt: nowIso(),
      enabledForMatching: 0,
    })
    .where(eq(profileSources.id, id))
    .run();
  logger.info({ id, type: row.type }, "profile source soft-deleted");
}

/**
 * @deprecated Use softDeleteProfileSource. Hard-delete kept for admin/tests only.
 */
export function deleteProfileSource(id: string): void {
  softDeleteProfileSource(id);
}
