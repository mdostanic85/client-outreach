import fs from "node:fs";
import path from "node:path";

let loaded = false;

/**
 * Load key=value pairs from client-outreach/.env into process.env (no overwrite).
 * Next.js already loads .env for the web app; tsx worker scripts need this.
 */
export function loadLocalEnv(cwd = process.cwd()) {
  if (loaded) return;
  loaded = true;
  const envPath = path.join(cwd, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
