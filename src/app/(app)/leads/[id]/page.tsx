import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadWorkspace } from "@/components/lead-workspace";
import { PageShell } from "@/components/page-shell";
import { getLeadDetail } from "@/modules/leads/queries";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = getLeadDetail(id);
  if (!detail) notFound();

  return (
    <PageShell width="lead" className="gap-8">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground w-fit text-xs transition-colors"
      >
        ← Today
      </Link>
      <LeadWorkspace detail={detail} />
    </PageShell>
  );
}
