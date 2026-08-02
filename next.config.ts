import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted on this app — parent Optra/ had a stray lockfile
  // that made Next infer the wrong workspace root and broke HMR.
  turbopack: {
    root: path.join(__dirname),
  },
  // Local-only MVP: never expose on all interfaces
  serverExternalPackages: [
    "better-sqlite3",
    "pino",
    "pino-pretty",
    "jsdom",
    "@mozilla/readability",
    "pdf-parse",
  ],
};

export default nextConfig;
