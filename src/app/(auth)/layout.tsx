import { redirect } from "next/navigation";
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

  return children;
}
