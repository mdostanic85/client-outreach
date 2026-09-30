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
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number;
  description?: string;
};

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
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-[background-color,color,transform] duration-150 ease-standard active:scale-[0.98]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-[background-color,height,opacity] duration-200 ease-enter",
          active
            ? "bg-brand h-6"
            : "bg-transparent group-hover:bg-brand/40",
        )}
      />
      <Icon
        className={cn(
          "nav-icon-motion size-[18px] shrink-0",
          active
            ? "text-brand-ink"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && item.count > 0 ? (
        <span
          className={cn(
            "badge-pop tabular rounded-md px-1.5 py-0.5 text-[12px] font-medium",
            active
              ? "bg-brand/20 text-brand-ink"
              : "bg-white/8 text-muted-foreground",
          )}
        >
          {item.count}
        </span>
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
        "border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full w-[240px] shrink-0 flex-col border-r",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <span
          aria-hidden
          className="brand-breathe bg-brand size-2.5 rounded-[5px]"
        />
        <Link
          href="/"
          onClick={() => handleNavigate("/")}
          className="text-[17px] font-medium tracking-tight text-foreground"
        >
          Optra
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 pt-2 pb-4">
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
          <MakerCredit className="px-3 pb-2" />
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
