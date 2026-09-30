"use client";

import type { ComponentType } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Briefcase,
  ChevronsUpDown,
  LogOut,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/modules/auth/actions";
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
 * lime indicator.
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
  { group: "Daily", item: { href: "/jobs", label: "Job", icon: Briefcase } },
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
function initials(name: string | null | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase() || "?";
}

/** Account row pinned to the bottom of the sidebar: who is signed in + log out. */
function SidebarAccount({ name, email }: { name?: string | null; email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={formRef} action={signOutAction} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="hover:bg-sidebar-accent aria-expanded:bg-sidebar-accent flex w-full items-center gap-3 rounded-panel p-2 text-left transition-colors duration-150 ease-standard"
            />
          }
        >
          <span className="bg-brand-gradient text-on-brand grid size-9 shrink-0 place-items-center rounded-full text-caption font-medium">
            {initials(name, email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-body-sm">{name?.trim() || "Account"}</span>
            <span className="text-muted-foreground block truncate text-caption">{email}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-56">
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings" />}>
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => formRef.current?.requestSubmit()}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-ink-tertiary px-3.5 pt-3 pb-1 text-caption">{label}</p>
      {children}
    </div>
  );
}

/**
 * Dark navigation panel. Two groups (daily work, setup), settings and the
 * signed-in account pinned to the bottom. The desktop version floats as a
 * 20px-radius panel on the page tint; the mobile sheet uses it edge to edge.
 */
export function AppSidebarNav({
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
  isOwner = false,
  userName,
  userEmail,
  onNavigate,
  className,
}: {
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
  isOwner?: boolean;
  userName?: string | null;
  userEmail?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  // Highlight the clicked item right away; it expires once the route changes.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const activeHref = pending && pending.from === pathname ? pending.href : pathname;

  const handleNavigate = (href: string) => {
    setPending({ href, from: pathname });
    onNavigate?.();
  };

  const daily: NavItem[] = [
    { href: "/", label: "Today", icon: Inbox },
    { href: "/interested", label: "Saved", icon: Bookmark, count: interestedCount },
    ...(isOwner
      ? [{ href: "/queue", label: "Queue", icon: Send, count: queueCount }]
      : []),
  ];
  const setup: NavItem[] = [
    { href: "/profile", label: "Profile", icon: UserRound, count: profileFitCount },
    { href: "/search-criteria", label: "Search criteria", icon: Search },
    { href: "/learning", label: "Improve", icon: Sparkles },
  ];
  const settingsItem: NavItem = { href: "/settings", label: "Settings", icon: Settings };

  const link = (item: NavItem) => (
    <NavLink
      key={item.href}
      item={item}
      active={isActive(activeHref, item.href)}
      onNavigate={() => handleNavigate(item.href)}
    />
  );

  return (
    <aside
      className={cn(
        "dark bg-sidebar text-sidebar-foreground flex h-full w-[248px] shrink-0 flex-col",
        className,
      )}
    >
      <div className="mt-5 flex h-16 shrink-0 items-center justify-center px-5">
        <OptraLogo href="/" width={104} tone="light" onClick={() => handleNavigate("/")} />
      </div>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        <NavGroup label="Daily">{daily.map(link)}</NavGroup>
        <NavGroup label="Setup">{setup.map(link)}</NavGroup>
        <div className="mt-auto flex flex-col gap-1 pt-4">{link(settingsItem)}</div>
      </nav>

      <div className="border-border shrink-0 space-y-3 border-t p-3">
        {userEmail ? <SidebarAccount name={userName} email={userEmail} /> : null}
        <MakerCredit className="px-2" />
      </div>
    </aside>
  );
}

export function AppSidebar({
  queueCount = 0,
  interestedCount = 0,
  profileFitCount = 0,
  isOwner = false,
  userName,
  userEmail,
}: {
  queueCount?: number;
  interestedCount?: number;
  profileFitCount?: number;
  isOwner?: boolean;
  userName?: string | null;
  userEmail?: string;
}) {
  return (
    <div className="sticky top-0 hidden h-svh shrink-0 p-3 pr-0 lg:block">
      <AppSidebarNav
        queueCount={queueCount}
        interestedCount={interestedCount}
        profileFitCount={profileFitCount}
        isOwner={isOwner}
        userName={userName}
        userEmail={userEmail}
        className="shadow-card rounded-card overflow-hidden"
      />
    </div>
  );
}
