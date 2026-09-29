"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Inbox,
  Search,
  Send,
  Settings,
  UserRound,
} from "lucide-react";
import { MakerCredit } from "@/components/maker-credit";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number;
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-150",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-white/5 hover:text-[var(--card-foreground)]",
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-[var(--card-foreground)]",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && item.count > 0 ? (
        <span className="bg-white/8 text-muted-foreground rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular">
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}

export function AppSidebarNav({
  leadsCount = 0,
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
  onNavigate,
  className,
}: {
  leadsCount?: number;
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
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

  const primary: NavItem[] = [
    { href: "/", label: "Today", icon: Inbox, count: leadsCount },
    {
      href: "/interested",
      label: "Interested",
      icon: Bookmark,
      count: interestedCount,
    },
    { href: "/queue", label: "Queue", icon: Send, count: queueCount },
    {
      href: "/profile",
      label: "Profile",
      icon: UserRound,
      count: profileFitCount,
    },
    { href: "/search-criteria", label: "Search", icon: Search },
  ];

  const secondary: NavItem = {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  };

  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full w-[232px] shrink-0 flex-col border-r",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <span aria-hidden className="bg-primary size-2.5 rounded-[5px]" />
        <Link
          href="/"
          onClick={() => handleNavigate("/")}
          className="font-display text-[17px] font-semibold tracking-tight text-[var(--card-foreground)]"
        >
          Optra
        </Link>
      </div>

      <nav className="flex flex-1 flex-col px-2.5 pb-4">
        <div className="space-y-1 pt-2">
          {primary.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(activeHref, item.href)}
              onNavigate={() => handleNavigate(item.href)}
            />
          ))}
        </div>

        <div className="mt-auto space-y-3">
          <NavLink
            item={secondary}
            active={isActive(activeHref, secondary.href)}
            onNavigate={() => handleNavigate(secondary.href)}
          />
          <MakerCredit className="px-3 pb-2" />
        </div>
      </nav>
    </aside>
  );
}

export function AppSidebar({
  leadsCount = 0,
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
}: {
  leadsCount?: number;
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
}) {
  return (
    <div className="sticky top-0 hidden h-svh lg:block">
      <AppSidebarNav
        leadsCount={leadsCount}
        queueCount={queueCount}
        interestedCount={interestedCount}
        profileFitCount={profileFitCount}
        className="h-svh"
      />
    </div>
  );
}
