import { QueueWorkspace } from "@/components/queue-workspace";
import { ensureDb } from "@/db/ensure";
import { listApplicationMailBoard } from "@/modules/applications/board";
import {
  getMailboxStatus,
  listOutboundBoard,
  listRecentDeliveryEvents,
} from "@/modules/mail/queries";
import { requireOwnerPage } from "@/modules/auth/page-guards";

export const dynamic = "force-dynamic";

export default async function QueuePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwnerPage();
  await ensureDb();
  const sp = (await searchParams) ?? {};
  const tabRaw = typeof sp.tab === "string" ? sp.tab : "";
  const initialTab =
    tabRaw === "outreach" ? "outreach" : "applications";

  const [applications, board, status, events] = await Promise.all([
    listApplicationMailBoard(),
    listOutboundBoard(),
    getMailboxStatus(),
    listRecentDeliveryEvents(20),
  ]);

  return (
    <QueueWorkspace
      applications={applications}
      outreach={board}
      status={status}
      events={events}
      initialTab={initialTab}
    />
  );
}
