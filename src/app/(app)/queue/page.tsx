import { QueueBoard } from "@/components/queue-board";
import { ensureDb } from "@/db/ensure";
import {
  getMailboxStatus,
  listOutboundBoard,
  listRecentDeliveryEvents,
} from "@/modules/mail/queries";

export const dynamic = "force-dynamic";

export default function QueuePage() {
  ensureDb();
  const board = listOutboundBoard();
  const status = getMailboxStatus();
  const events = listRecentDeliveryEvents(20);

  return <QueueBoard board={board} status={status} events={events} />;
}
