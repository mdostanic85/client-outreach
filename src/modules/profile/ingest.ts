import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { currentUserId, owned } from "@/modules/auth/current-user";
import type { ProfileSourceType } from "./schemas";

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** Writable path for optional PDF copies. Vercel only allows /tmp. */
function sourcesDir(): string {
  const root = process.env.VERCEL ? "/tmp/optra" : process.cwd();
  const dir = path.join(root, "data", "profile-sources");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function loadRetrievePage() {
  const { retrievePage } = await import("@/lib/retrieval/fetch-page");
  return retrievePage;
}

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};

/**
 * Joins pdf.js text items line by line. A wide horizontal gap becomes a tab so
 * column layouts ("2019–2023 ⇥ Company ⇥ Role", tool lists) keep their cells.
 */
export function joinPdfTextItems(items: PdfTextItem[]): string {
  let out = "";
  let lineEndX: number | null = null;
  let lineY: number | null = null;
  let lastSize = 0;
  for (const item of items) {
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const size = Math.abs(item.height) || Math.abs(item.transform[3] ?? 0) || 10;
    if (lineY != null && Math.abs(y - lineY) > size * 0.5 && !out.endsWith("\n")) {
      out += "\n";
      lineEndX = null;
    }
    if (item.str.trim().length > 0) {
      if (lineEndX != null && !out.endsWith("\n")) {
        const gap = x - lineEndX;
        const small = Math.min(size, lastSize);
        // A jump in font size marks a new cell too ("Company" in large type, then "Role").
        const sizeJump = Math.max(size, lastSize) / small > 1.3;
        if (gap > small * 1.5 || (sizeJump && gap > small * 0.3)) {
          out = out.replace(/[ \t]+$/, "") + "\t";
        } else if (gap > small * 0.15 && !/\s$/.test(out)) {
          out += " ";
        }
      }
      out += item.str;
      lineEndX = x + item.width;
      lineY = y;
      lastSize = size;
    } else if (item.str.length > 0 && lineEndX != null) {
      lineEndX = x + item.width;
    }
    if (item.hasEOL) {
      out += "\n";
      lineEndX = null;
    }
  }
  return out
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// Design-tool exports (Figma, Canva) embed Type 3 fonts; older pdf.js builds return no text for them.
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.flatMap((i) => ("str" in i ? [i as PdfTextItem] : []));
    pages.push(joinPdfTextItems(items));
  }
  return pages.join("\n\n").trim();
}

async function findActiveByHash(contentHash: string) {
  return (await getDb()
    .select()
    .from(profileSources)
    .where(
      and(
        await owned(profileSources),
        eq(profileSources.contentHash, contentHash),
        isNull(profileSources.deletedAt),
      ),
    ).limit(1))[0];
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
  const existing = await findActiveByHash(contentHash);
  if (existing) {
    const syncedAt = nowIso();
    await db.update(profileSources)
      .set({ lastSyncedAt: syncedAt })
      .where(and(await owned(profileSources), eq(profileSources.id, existing.id)));
    return { id: existing.id, reused: true };
  }

  const id = newId("psrc");
  const syncedAt = nowIso();
  await db.insert(profileSources)
    .values({
      id,
      userId: await currentUserId(),
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
    });

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

    // Best-effort PDF copy for local debugging. Extracted text is the source of truth in DB.
    try {
      const dest = path.join(sourcesDir(), `${id}.pdf`);
      fs.writeFileSync(dest, input.bytes);
      filePath = dest;
    } catch (err) {
      logger.warn({ err }, "Could not persist PDF copy; continuing with extracted text");
      filePath = null;
    }

    const contentHash = hashContent(`${type}:${rawText}`);
    const db = getDb();
    const existing = await findActiveByHash(contentHash);
    if (existing) {
      if (filePath) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup errors
        }
      }
      const syncedAt = nowIso();
      await db.update(profileSources)
        .set({ lastSyncedAt: syncedAt })
        .where(and(await owned(profileSources), eq(profileSources.id, existing.id)));
      return {
        id: existing.id,
        reused: true,
        textLength: existing.rawText?.length ?? 0,
      };
    }

    const syncedAt = nowIso();
    await db.insert(profileSources)
      .values({
        id,
        userId: await currentUserId(),
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
      });

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
  return await ingestFileUpload({ ...input, type: "cv" });
}

const MAX_SITE_PAGES = 8;
const MAX_PAGE_CHARS = 8_000;
const MAX_SITE_CHARS = 48_000;

/** Pages that describe the person's work rank first; boilerplate is skipped. */
function rankSitePath(pathname: string): number {
  const p = pathname.toLowerCase();
  if (/\.(pdf|jpe?g|png|gif|svg|webp|mp4|zip|xml|json|css|js)$/.test(p)) return -1;
  if (/(privacy|terms|legal|imprint|impressum|cookie|login|signin|signup|cart|checkout|tag\/|category\/|feed|rss|wp-)/.test(p)) return -1;
  if (/(case|work|project|portfolio|studies|study|selected|client)/.test(p)) return 3;
  if (/(about|bio|cv|resume|experience|services|process)/.test(p)) return 2;
  if (/(blog|posts?|articles?|writing|notes)\//.test(p)) return 0;
  return 1;
}

/**
 * Reads a personal site or portfolio: the given page plus its most relevant
 * same-site pages (case studies, projects, about). Stored as one source so
 * the profile extract sees the whole body of work.
 */
export async function crawlPortfolio(url: string): Promise<{
  text: string;
  title: string | null;
  finalUrl: string;
  pages: number;
}> {
  const retrievePage = await loadRetrievePage();
  const root = await retrievePage(url);
  if (root.status !== "ok" || !root.extractedText?.trim()) {
    throw new Error(root.error ?? "Failed to fetch portfolio page");
  }
  const rootUrl = root.finalUrl || url;
  const candidates = (root.links ?? [])
    .filter((link) => link !== rootUrl && link.replace(/\/$/, "") !== rootUrl.replace(/\/$/, ""))
    .map((link) => ({ link, rank: rankSitePath(new URL(link).pathname) }))
    .filter((c) => c.rank >= 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_SITE_PAGES)
    .map((c) => c.link);

  const subpages = await Promise.all(candidates.map((link) => retrievePage(link)));
  const sections = [root, ...subpages]
    .filter((page) => page.status === "ok" && page.extractedText?.trim())
    .map((page) => {
      const heading = page.title ? `${page.title} (${page.finalUrl})` : page.finalUrl;
      return `## ${heading}\n${page.extractedText!.slice(0, MAX_PAGE_CHARS)}`;
    });

  return {
    text: sections.join("\n\n").slice(0, MAX_SITE_CHARS),
    title: root.title,
    finalUrl: rootUrl,
    pages: sections.length,
  };
}

export async function ingestPortfolioUrl(
  url: string,
): Promise<{ id: string; reused: boolean; textLength: number; pages: number }> {
  const site = await crawlPortfolio(url);
  const result = await ingestTextSource({
    type: "portfolio_url",
    text: site.text,
    label: site.title ?? url,
    sourceUrl: site.finalUrl,
  });
  logger.info({ url: site.finalUrl, pages: site.pages }, "portfolio site ingested");
  return {
    ...result,
    textLength: site.text.length,
    pages: site.pages,
  };
}

/** Refresh an existing portfolio/GitHub source without deleting knowledge. */
export async function refreshProfileSource(
  id: string,
): Promise<{ id: string; textLength: number }> {
  const db = getDb();
  const row = (await db
    .select()
    .from(profileSources)
    .where(and(await owned(profileSources), eq(profileSources.id, id), isNull(profileSources.deletedAt))).limit(1))[0];
  if (!row) throw new Error("Source not found");

  if (row.type === "portfolio_url") {
    if (!row.sourceUrl) throw new Error("Portfolio source has no URL to refresh");
    const site = await crawlPortfolio(row.sourceUrl);
    const syncedAt = nowIso();
    await db.update(profileSources)
      .set({
        rawText: site.text,
        label: site.title ?? row.label,
        contentHash: hashContent(`portfolio_url:${site.text}`),
        lastSyncedAt: syncedAt,
      })
      .where(and(await owned(profileSources), eq(profileSources.id, id)));
    return { id, textLength: site.text.length };
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
    await db.update(profileSources)
      .set({
        rawText: corpus.text,
        label: `GitHub @${corpus.username}`,
        sourceUrl: corpus.sourceUrl,
        contentHash: hashContent(`github:${corpus.text}`),
        lastSyncedAt: syncedAt,
      })
      .where(and(await owned(profileSources), eq(profileSources.id, id)));
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

export async function setProfileSourceMatchingEnabled(
  id: string,
  enabled: boolean,
): Promise<void> {
  const db = getDb();
  const row = (await db
    .select()
    .from(profileSources)
    .where(and(await owned(profileSources), eq(profileSources.id, id), isNull(profileSources.deletedAt))).limit(1))[0];
  if (!row) throw new Error("Source not found");
  await db.update(profileSources)
    .set({ enabledForMatching: enabled ? 1 : 0 })
    .where(and(await owned(profileSources), eq(profileSources.id, id)));
}

/**
 * Soft-delete a source. Does not mutate structured profile JSON.
 * Requires an explicit user confirmation in the UI.
 */
export async function softDeleteProfileSource(id: string): Promise<void> {
  const db = getDb();
  const row = (await db
    .select()
    .from(profileSources)
    .where(and(await owned(profileSources), eq(profileSources.id, id), isNull(profileSources.deletedAt))).limit(1))[0];
  if (!row) return;
  await db.update(profileSources)
    .set({
      deletedAt: nowIso(),
      enabledForMatching: 0,
    })
    .where(and(await owned(profileSources), eq(profileSources.id, id)));
  logger.info({ id, type: row.type }, "profile source soft-deleted");
}

/**
 * @deprecated Use softDeleteProfileSource. Hard-delete kept for admin/tests only.
 */
export async function deleteProfileSource(id: string): Promise<void> {
  await softDeleteProfileSource(id);
}
