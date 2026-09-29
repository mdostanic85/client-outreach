import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Node 22+ loads next.config.ts as ESM, where __dirname is missing and
// path.join(__dirname) collapses to ".". Turbopack then cannot resolve
// next/package.json and HMR panics in a reload loop.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Next allows one `next dev` per build dir; NEXT_DIST_DIR lets a second
  // local preview run beside the main server. Default stays `.next`.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Keep Turbopack rooted on this app — a stray lockfile makes Next infer
  // the wrong workspace root and breaks HMR.
  turbopack: {
    root: appRoot,
  },
  experimental: {
    // CV / LinkedIn PDF uploads go through Server Actions (default cap is 1MB).
    serverActions: { bodySizeLimit: "10mb" },
  },
  serverExternalPackages: [
    "@neondatabase/serverless",
    "pino",
    "pino-pretty",
    "jsdom",
    "@mozilla/readability",
    "unpdf",
  ],
};

export default nextConfig;
