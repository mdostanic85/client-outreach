import { ensureDb } from "@/db/ensure";
import { getAuth } from "@/modules/auth/auth";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  await ensureDb();
  return getAuth().handler(request);
}

export { handle as GET, handle as POST };
