import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { ensureDb } from "@/db/ensure";
import { signOutAction } from "@/modules/auth/actions";
import { currentUserId, isOwner } from "@/modules/auth/current-user";
import { getSessionUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

type Row = { href: string; label: string; description: string };

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-3 text-body-sm font-medium">
        {title}
      </h2>
      <ul data-reveal className="bg-card shadow-card divide-y divide-border overflow-hidden rounded-card">
        {rows.map((row) => (
          <li key={row.href}>
            <Link
              href={row.href}
              className="group interactive-row flex items-center justify-between gap-4 px-5 py-4 focus-visible:-outline-offset-2"
            >
              <span>
                <span className="text-foreground block text-body">
                  {row.label}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-body-sm">
                  {row.description}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors duration-150" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SettingsPage() {
  await ensureDb();
  const user = await getSessionUser();
  const owner = await isOwner(await currentUserId());

  return (
    <PageShell width="setup">
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-10">
        <Section
          title="Job search"
          rows={[
            {
              href: "/learning",
              label: "Improve my search",
              description: "Log what happened after you applied and review suggested changes.",
            },
          ]}
        />

        {owner ? (
          <Section
            title="Workspace"
            rows={[
              {
                href: "/settings/voice",
                label: "Outreach voice",
                description: "Positioning and writing style for company emails.",
              },
              {
                href: "/analytics",
                label: "Analytics",
                description: "How outreach and applications are performing.",
              },
              {
                href: "/admin",
                label: "Admin",
                description: "API keys, mailbox and AI budget.",
              },
            ]}
          />
        ) : null}

        <section>
          <h2 className="text-muted-foreground mb-3 text-body-sm font-medium">
            Account
          </h2>
          <div data-reveal className="bg-card shadow-card flex flex-wrap items-center justify-between gap-4 rounded-card px-5 py-4">
            <span className="min-w-0 text-body break-all">{user?.email}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
