"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Inbox,
  LineChart,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { MakerCredit } from "@/components/maker-credit";
import { OptraLogo } from "@/components/optra-logo";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number;
  description?: string;
};

/**
 * 40px pill on the dark sidebar. Inactive at secondary ink with a hairline
 * pill outline on hover; active sits on a raised surface with a small
 * verdigris indicator.
 */
function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-full border px-3.5 text-body-sm transition-[background-color,color,border-color] duration-150 ease-standard sm:text-body",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground border-transparent"
          : "text-sidebar-foreground hover:border-border-hover hover:text-foreground border-transparent",
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors duration-150 ease-standard",
          active ? "text-brand-ink" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && item.count > 0 ? (
        <span
          className={cn(
            "tabular rounded-full px-2 py-0.5 text-caption",
            active ? "bg-brand-wash text-brand-ink" : "bg-subtle text-muted-foreground",
          )}
        >
          {item.count}
        </span>
      ) : null}
      {active ? (
        <span aria-hidden className="bg-brand size-1.5 shrink-0 rounded-full" />
      ) : null}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Page context for the topbar breadcrumb. Covers routes reached from inside
 * Profile or Settings too, not only the sidebar links.
 */
const PAGE_CONTEXT: { group: string; item: NavItem }[] = [
  { group: "Daily", item: { href: "/", label: "Today", icon: Inbox } },
  { group: "Daily", item: { href: "/interested", label: "Saved", icon: Bookmark } },
  { group: "Daily", item: { href: "/queue", label: "Queue", icon: Send } },
  { group: "Setup", item: { href: "/profile", label: "Profile", icon: UserRound } },
  { group: "Setup", item: { href: "/search-criteria", label: "Search", icon: Search } },
  { group: "Setup", item: { href: "/learning", label: "Improve", icon: Sparkles } },
  { group: "Setup", item: { href: "/settings", label: "Settings", icon: Settings } },
  { group: "System", item: { href: "/analytics", label: "Analytics", icon: LineChart } },
  { group: "System", item: { href: "/admin", label: "Admin", icon: Shield } },
];

/** Nav group + item for a pathname (deepest match wins; "/" only matches itself). */
export function navContextFor(pathname: string): { group: string; item: NavItem } | null {
  let best: { group: string; item: NavItem } | null = null;
  for (const entry of PAGE_CONTEXT) {
    if (!isActive(pathname, entry.item.href)) continue;
    if (!best || entry.item.href.length > best.item.href.length) best = entry;
  }
  return best;
}

/**
 * Four destinations for everyone: Today, Saved, Profile, Settings.
 * The owner also gets Queue (client outreach). Everything else lives inside
 * Profile or Settings so the sidebar never grows.
 */
export function AppSidebarNav({
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
  isOwner = false,
  onNavigate,
  className,
}: {
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
  isOwner?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const activeHref = pendingHref ?? pathname;

  const handleNavigate = (href: string) => {
    setPendingHref(href);
    onNavigate?.();
  };

  const main: NavItem[] = [
    { href: "/", label: "Today", icon: Inbox },
    { href: "/interested", label: "Saved", icon: Bookmark, count: interestedCount },
    ...(isOwner
      ? [{ href: "/queue", label: "Queue", icon: Send, count: queueCount }]
      : []),
    { href: "/profile", label: "Profile", icon: UserRound, count: profileFitCount },
  ];
  const settingsItem: NavItem = { href: "/settings", label: "Settings", icon: Settings };

  return (
    <aside
      className={cn(
        "dark bg-sidebar text-sidebar-foreground flex h-full w-[240px] shrink-0 flex-col",
        className,
      )}
    >
      <div className="flex h-16 items-center px-5">
        <OptraLogo href="/" width={84} tone="light" onClick={() => handleNavigate("/")} />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-2 pb-4">
        {main.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(activeHref, item.href)}
            onNavigate={() => handleNavigate(item.href)}
          />
        ))}
        <div className="mt-auto space-y-4">
          <NavLink
            item={settingsItem}
            active={isActive(activeHref, settingsItem.href)}
            onNavigate={() => handleNavigate(settingsItem.href)}
          />
          <MakerCredit className="px-3.5 pb-2" />
        </div>
      </nav>
    </aside>
  );
}

export function AppSidebar({
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
  isOwner = false,
}: {
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
  isOwner?: boolean;
}) {
  return (
    <div className="sticky top-0 hidden h-svh lg:block">
      <AppSidebarNav
        queueCount={queueCount}
        interestedCount={interestedCount}
        profileFitCount={profileFitCount}
        isOwner={isOwner}
        className="h-svh"
      />
    </div>
  );
}
