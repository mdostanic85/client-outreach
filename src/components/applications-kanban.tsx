"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markApplicationGotReplyAction } from "@/modules/applications/actions";
import { Send } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ApplicationMailBoard,
  ApplicationMailCard,
  ApplicationMailColumn,
} from "@/modules/applications/board";

const COLUMNS: Array<{
  id: ApplicationMailColumn;
  label: string;
  hint: string;
}> = [
  { id: "sent", label: "Sent", hint: "Waiting for a reply" },
  { id: "waiting", label: "Waiting", hint: "No reply yet — consider follow-up" },
  { id: "follow_up", label: "Follow-up", hint: "They replied" },
];

function formatSentAt(value: string | null): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function Card({
  card,
  onGotReply,
  pending,
}: {
  card: ApplicationMailCard;
  onGotReply: (packageId: string) => void;
  pending: boolean;
}) {
  return (
    <li data-reveal className="bg-card space-y-3 rounded-panel p-4 shadow-card">
      <div className="space-y-0.5">
        <p className="text-foreground text-body">
          {card.companyName}
        </p>
        <p className="text-muted-foreground text-body-sm">
          {card.jobTitle}
        </p>
        {card.sentAt ? (
          <p className="text-muted-foreground text-body-sm">
            Sent {formatSentAt(card.sentAt)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/interested/${card.jobId}/package`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Open
        </Link>
        {card.column !== "follow_up" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => onGotReply(card.packageId)}
          >
            Got reply
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ApplicationsKanban({ board }: { board: ApplicationMailBoard }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const total =
    board.sent.length + board.waiting.length + board.follow_up.length;

  const gotReply = (packageId: string) => {
    start(async () => {
      await markApplicationGotReplyAction(packageId);
      router.refresh();
    });
  };

  if (total === 0) {
    return (
      <div data-reveal className="bg-card rounded-card shadow-card">
        <EmptyState
          title="No applications sent yet"
          description="Prepare a package from Saved, then Send."
          icon={<Send className="size-5" strokeWidth={1.5} />}
          actionLabel="Go to Saved"
          actionHref="/interested"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const cards = board[col.id];
        return (
          <section key={col.id} className="min-w-0 space-y-3">
            <header className="space-y-0.5 px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground text-body font-medium">{col.label}</h3>
                <span className={badgeVariants({ variant: "outline", className: "tabular" })}>
                  {cards.length}
                </span>
              </div>
              <p className="text-muted-foreground text-body-sm">{col.hint}</p>
            </header>
            <ul className="min-h-[12rem] space-y-3">
              {cards.length === 0 ? (
                <li className="text-muted-foreground border-border-strong rounded-panel border border-dashed px-2 py-10 text-center text-body-sm">
                  Empty
                </li>
              ) : (
                cards.map((card) => (
                  <Card
                    key={card.packageId}
                    card={card}
                    onGotReply={gotReply}
                    pending={pending}
                  />
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
