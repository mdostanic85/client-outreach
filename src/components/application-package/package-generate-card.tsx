"use client";

import { Surface } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PackageMarket } from "@/modules/applications/schemas";


/** Before a package exists: pick the market and generate the CV and letter. */
export function PackageGenerateCard({
  market,
  setMarket,
  pending,
  hasApprovedProfile,
  generate,
}: {
  market: PackageMarket;
  setMarket: (market: PackageMarket) => void;
  pending: boolean;
  hasApprovedProfile: boolean;
  generate: () => void;
}) {
  return (
    <Surface className="p-6 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-2">
          <h2 className="text-h5 font-medium">
            Prepare this application
          </h2>
          <p className="text-muted-foreground text-body leading-relaxed">
            Generate a tailored one-page CV and cover letter from your
            approved profile. Market sets US Resume vs Europe CV wording —
            layout stays ATS-safe either way.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="package-market">Market</Label>
          <Select
            value={market}
            onValueChange={(value) => {
              if (value === "us" || value === "europe") setMarket(value);
            }}
            disabled={pending}
            items={{
              europe: "Europe (CV)",
              us: "United States (Resume)",
            }}
          >
            <SelectTrigger id="package-market" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start">
              <SelectItem value="europe">Europe (CV)</SelectItem>
              <SelectItem value="us">United States (Resume)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={pending || !hasApprovedProfile}
          onClick={generate}
          className="w-full sm:w-auto"
        >
          {pending ? "Generating…" : "Generate package"}
        </Button>
      </div>
    </Surface>
  );
}
