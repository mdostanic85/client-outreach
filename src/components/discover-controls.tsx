"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runVerticalSliceAction, submitManualCompanyAction } from "@/modules/discovery/actions";
import { runDailyPipelineAction } from "@/modules/ops/actions";
import { InlineAlert } from "@/components/inline-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DiscoverControls() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");

  const run = (
    fn: () => Promise<{
      ok: boolean;
      error?: string;
      data?: { leadId?: string; runId?: string };
    }>,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed");
      else if (result.data && "leadId" in result.data && result.data.leadId) {
        router.push(`/leads/${result.data.leadId}`);
      } else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <InlineAlert variant="error">{error}</InlineAlert>
      ) : null}

      <div>
        <p className="text-foreground mb-1 text-body font-medium">Company URL</p>
        <p className="text-muted-foreground mb-3 text-body-sm">
          Highest-precision source — paste a site and research immediately.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="manual-name">Name</Label>
            <Input
              id="manual-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Design"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual-url">URL</Label>
            <Input
              id="manual-url"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://acme.example"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={pending || !companyName.trim() || !companyUrl.trim()}
            onClick={() =>
              run(() =>
                submitManualCompanyAction({
                  companyName: companyName.trim(),
                  companyUrl: companyUrl.trim(),
                  researchNow: true,
                }),
              )
            }
          >
            Research company
          </Button>
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => run(() => runVerticalSliceAction())}
          >
            Discover one
          </Button>
          <Button
            disabled={pending}
            variant="outline"
            onClick={() => run(() => runDailyPipelineAction())}
          >
            Run daily sync
          </Button>
        </div>
      </div>
    </div>
  );
}
