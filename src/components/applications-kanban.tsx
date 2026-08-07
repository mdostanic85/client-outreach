"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markApplicationGotReplyAction } from "@/app/actions";
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
    <li className="border-border bg-card space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <p className="text-[15px] font-medium leading-snug">
          {card.companyName}
        </p>
        <p className="text-muted-foreground text-[14px] leading-snug">
          {card.jobTitle}
        </p>
        {card.sentAt ? (
          <p className="text-muted-foreground text-[13px]">
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
      <div className="border-border rounded-2xl border px-6 py-12 text-center">
        <p className="font-medium text-[15px]">No applications sent yet</p>
        <p className="text-muted-foreground mt-2 text-[14px]">
          Prepare a package from Interested, then Send.
        </p>
        <Link
          href="/interested"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-5 inline-flex",
          )}
        >
          Go to Interested
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const cards = board[col.id];
        return (
          <section key={col.id} className="min-w-0 space-y-3">
            <header className="space-y-0.5 px-1">
              <div className="flex items-baseline gap-2">
                <h3 className="text-[15px] font-medium">{col.label}</h3>
                <span className="text-muted-foreground tabular text-[13px]">
                  {cards.length}
                </span>
              </div>
              <p className="text-muted-foreground text-[13px]">{col.hint}</p>
            </header>
            <ul className="bg-muted/20 space-y-3 rounded-2xl p-3 min-h-[12rem]">
              {cards.length === 0 ? (
                <li className="text-muted-foreground px-2 py-6 text-center text-[13px]">
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
