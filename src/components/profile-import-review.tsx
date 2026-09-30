"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyProfileDiffDecisionsAction } from "@/app/actions";
import { InlineAlert } from "@/components/inline-alert";
import { PanelBody, PanelHeader, Surface } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DiffDecision,
  ProfileDiffItem,
} from "@/modules/profile/diff";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<
  ProfileDiffItem["category"],
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "bg-brand/15 text-brand-ink ring-1 ring-brand/25",
  },
  updated: {
    label: "Updated",
    className: "bg-subtle text-ink-emphasis ring-1 ring-border",
  },
  conflict: {
    label: "Conflict",
    className: "bg-warn-wash text-warn ring-1 ring-warn/25",
  },
  missing: {
    label: "Missing in import",
    className: "bg-muted text-muted-foreground ring-1 ring-border",
  },
  uncertain: {
    label: "Uncertain",
    className: "bg-destructive/10 text-destructive ring-1 ring-destructive/25",
  },
  unchanged: {
    label: "Unchanged",
    className: "bg-muted text-muted-foreground",
  },
};

function defaultDecision(item: ProfileDiffItem): DiffDecision {
  if (item.category === "new" || item.category === "updated") return "accept";
  if (item.category === "conflict" || item.category === "missing") {
    return "keep_previous";
  }
  return "reject";
}

export function ProfileImportReview({
  draftId,
  items,
}: {
  draftId: string;
  items: ProfileDiffItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<Record<string, DiffDecision>>(() => {
    const init: Record<string, DiffDecision> = {};
    for (const item of items) init[item.id] = defaultDecision(item);
    return init;
  });

  const actionable = useMemo(
    () => items.filter((i) => i.category !== "unchanged"),
    [items],
  );

  const counts = useMemo(() => {
    const c = { new: 0, updated: 0, conflict: 0, missing: 0, uncertain: 0 };
    for (const item of actionable) {
      if (item.category in c) {
        c[item.category as keyof typeof c] += 1;
      }
    }
    return c;
  }, [actionable]);

  if (actionable.length === 0) return null;

  const setDecision = (id: string, decision: DiffDecision) => {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  };

  const apply = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applyProfileDiffDecisionsAction({
        draftId,
        decisions,
        edits,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not apply review");
        return;
      }
      setMessage("Review applied to your draft. Approve when ready.");
      router.refresh();
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ProfileDiffItem[]>();
    for (const item of actionable) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return [...map.entries()];
  }, [actionable]);

  return (
    <Surface>
      <PanelHeader className="flex-col items-start gap-2">
        <p className="text-body font-medium">
          Review before saving
        </p>
        <p className="text-muted-foreground text-body-sm leading-relaxed">
          New information from your latest import. Accept, edit, or reject each
          item before it merges into your Professional Profile.
        </p>
        <div className="flex flex-wrap gap-2">
          {counts.new > 0 ? (
            <Badge className={CATEGORY_META.new.className}>
              {counts.new} new
            </Badge>
          ) : null}
          {counts.updated > 0 ? (
            <Badge className={CATEGORY_META.updated.className}>
              {counts.updated} updated
            </Badge>
          ) : null}
          {counts.conflict > 0 ? (
            <Badge className={CATEGORY_META.conflict.className}>
              {counts.conflict} conflicts
            </Badge>
          ) : null}
          {counts.missing > 0 ? (
            <Badge className={CATEGORY_META.missing.className}>
              {counts.missing} missing in import
            </Badge>
          ) : null}
          {counts.uncertain > 0 ? (
            <Badge className={CATEGORY_META.uncertain.className}>
              {counts.uncertain} uncertain
            </Badge>
          ) : null}
        </div>
      </PanelHeader>
      <PanelBody className="space-y-6">
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        {message ? <InlineAlert variant="success">{message}</InlineAlert> : null}

        {grouped.map(([section, sectionItems]) => (
          <div key={section} className="space-y-3">
            <p className="text-muted-foreground text-body-sm font-medium">
              {section}
            </p>
            <ul className="space-y-3">
              {sectionItems.map((item) => {
                const decision = decisions[item.id] ?? defaultDecision(item);
                const meta = CATEGORY_META[item.category];
                const editableValue =
                  edits[item.id] ?? item.next ?? item.previous ?? "";
                return (
                  <li
                    key={item.id}
                    className="bg-subtle space-y-3 rounded-tile px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-body font-medium">{item.label}</p>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-caption font-medium",
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                        {item.note ? (
                          <p className="text-muted-foreground mt-1 text-body-sm">
                            {item.note}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {item.previous ? (
                      <p className="text-muted-foreground text-body-sm">
                        Current:{" "}
                        <span className="text-foreground">{item.previous}</span>
                      </p>
                    ) : null}

                    {item.category !== "missing" &&
                    item.category !== "uncertain" ? (
                      <Input
                        value={editableValue}
                        disabled={pending || decision === "reject" || decision === "keep_previous"}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Imported value"
                      />
                    ) : item.next ? (
                      <p className="text-body-sm">{item.next}</p>
                    ) : null}

                    {item.sources?.length ? (
                      <p className="text-muted-foreground text-caption">
                        Sources: {item.sources.join(", ")}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {item.category === "conflict" ||
                      item.category === "missing" ? (
                        <>
                          <Button
                            size="sm"
                            variant={
                              decision === "keep_previous" ? "default" : "outline"
                            }
                            disabled={pending}
                            onClick={() => setDecision(item.id, "keep_previous")}
                          >
                            Keep current
                          </Button>
                          {item.category === "conflict" ? (
                            <Button
                              size="sm"
                              variant={decision === "accept" ? "default" : "outline"}
                              disabled={pending}
                              onClick={() => setDecision(item.id, "accept")}
                            >
                              Use import
                            </Button>
                          ) : null}
                          {item.category === "missing" ? (
                            <Button
                              size="sm"
                              variant={decision === "reject" ? "destructive" : "outline"}
                              disabled={pending}
                              onClick={() => setDecision(item.id, "reject")}
                            >
                              Remove from profile
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant={decision === "accept" ? "default" : "outline"}
                            disabled={pending || item.category === "uncertain"}
                            onClick={() => setDecision(item.id, "accept")}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant={decision === "reject" ? "secondary" : "ghost"}
                            disabled={pending}
                            onClick={() => setDecision(item.id, "reject")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button size="lg" disabled={pending} onClick={apply}>
            {pending ? "Applying…" : "Apply review to draft"}
          </Button>
          <p className="text-muted-foreground self-center text-body-sm">
            Then approve the draft when the Professional Profile looks right.
          </p>
        </div>
      </PanelBody>
    </Surface>
  );
}
