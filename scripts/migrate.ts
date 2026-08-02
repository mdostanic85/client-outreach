import { runMigrations } from "../src/db/migrate";
import { loadLocalEnv } from "../src/lib/env";

async function main() {
  loadLocalEnv();
  await runMigrations();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
