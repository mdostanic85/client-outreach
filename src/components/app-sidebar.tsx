"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Inbox,
  LineChart,
  PenLine,
  Search,
  Send,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
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
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-[background-color,color,transform] duration-150 ease-[var(--ease-out-soft)] active:scale-[0.98]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-white/5 hover:text-[var(--card-foreground)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-[background-color,height,opacity] duration-200 ease-[var(--ease-emphasized)]",
          active
            ? "bg-primary h-6"
            : "bg-transparent group-hover:bg-primary/40",
        )}
      />
      <Icon
        className={cn(
          "nav-icon-motion size-[18px] shrink-0",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-[var(--card-foreground)]",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && item.count > 0 ? (
        <span
          className={cn(
            "badge-pop tabular rounded-md px-1.5 py-0.5 text-[12px] font-semibold",
            active
              ? "bg-primary/20 text-primary"
              : "bg-white/8 text-muted-foreground",
          )}
        >
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground/80 px-3 pb-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase">
        {label}
      </p>
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(pathname, item.href)}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sidebar — Linear / Twenty pattern (Mobbin):
 * brand, clear groups, left accent on active, badges for counts.
 */
export function AppSidebarNav({
  leadsCount = 0,
  queueCount = 0,
  interestedCount = 0,
  onNavigate,
  className,
}: {
  leadsCount?: number;
  queueCount?: number;
  interestedCount?: number;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  const daily: NavItem[] = [
    { href: "/", label: "Today", icon: Inbox, count: leadsCount },
    {
      href: "/interested",
      label: "Interested",
      icon: Bookmark,
      count: interestedCount,
    },
    { href: "/queue", label: "Queue", icon: Send, count: queueCount },
  ];
  const setup: NavItem[] = [
    { href: "/profile", label: "Profile", icon: UserRound },
    { href: "/search-criteria", label: "Search", icon: Search },
    { href: "/learning", label: "Improve", icon: Sparkles },
    {
      href: "/settings",
      label: "Voice",
      icon: PenLine,
      description: "Outreach voice & send volume",
    },
  ];
  const system: NavItem[] = [
    { href: "/analytics", label: "Analytics", icon: LineChart },
    { href: "/admin", label: "Admin", icon: Shield },
  ];

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
          className="brand-breathe bg-primary size-2.5 rounded-[5px]"
        />
        <Link
          href="/"
          onClick={onNavigate}
          className="font-display text-[17px] font-semibold tracking-tight text-[var(--card-foreground)]"
        >
          Optra
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-7 overflow-y-auto px-2.5 pb-6">
        <NavGroup
          label="Daily"
          items={daily}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <NavGroup
          label="Setup"
          items={setup}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <div className="mt-auto">
          <NavGroup
            label="System"
            items={system}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </div>
      </nav>
    </aside>
  );
}

export function AppSidebar({
  leadsCount = 0,
  queueCount = 0,
  interestedCount = 0,
}: {
  leadsCount?: number;
  queueCount?: number;
  interestedCount?: number;
}) {
  return (
    <div className="sticky top-0 hidden h-svh lg:block">
      <AppSidebarNav
        leadsCount={leadsCount}
        queueCount={queueCount}
        interestedCount={interestedCount}
        className="h-svh"
      />
    </div>
  );
}
