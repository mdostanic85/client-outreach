import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
