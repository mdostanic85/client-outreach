import { QueueBoard } from "@/components/queue-board";
import { ensureDb } from "@/db/ensure";
import {
  getMailboxStatus,
  listOutboundBoard,
  listRecentDeliveryEvents,
} from "@/modules/mail/queries";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  await ensureDb();
  const board = await listOutboundBoard();
  const status = await getMailboxStatus();
  const events = await listRecentDeliveryEvents(20);

  return <QueueBoard board={board} status={status} events={events} />;
}
