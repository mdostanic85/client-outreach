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
    <PageShell width="workspace">
      <LeadWorkspace detail={detail} />
    </PageShell>
  );
}
