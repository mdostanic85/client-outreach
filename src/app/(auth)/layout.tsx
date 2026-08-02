import { redirect } from "next/navigation";
import { isEphemeralDatabase } from "@/db/client";
import { ensureDb } from "@/db/ensure";
import { getSessionUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureDb();
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <>
      {isEphemeralDatabase() ? (
        <div className="bg-amber-500/15 text-amber-100 border-b border-amber-500/30 px-4 py-2.5 text-center text-[15px]">
          Cloud demo uses ephemeral storage — accounts and data can reset between
          deploys. Prefer local (`pnpm dev`) for real use.
        </div>
      ) : null}
      {children}
    </>
  );
}
