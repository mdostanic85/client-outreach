"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Send,
  LineChart,
  GraduationCap,
  PenLine,
  Shield,
  UserRound,
  Search,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/modules/auth/actions";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number;
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-4 rounded-xl px-3.5 py-3 text-[15px] transition-colors duration-150 ease-[var(--ease-out-soft)]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-white/5 hover:text-[var(--card-foreground)]",
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-[var(--card-foreground)]",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && item.count > 0 ? (
        <span className="tabular bg-white/8 text-muted-foreground rounded-lg px-2 py-0.5 text-[12px] font-medium">
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

export function AppSidebar({
  leadsCount = 0,
  queueCount = 0,
  budgetLabel,
  userEmail,
}: {
  leadsCount?: number;
  queueCount?: number;
  budgetLabel?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();

  const primary: NavItem[] = [
    { href: "/", label: "Today", icon: Inbox, count: leadsCount },
    { href: "/queue", label: "Queue", icon: Send, count: queueCount },
    { href: "/profile", label: "Profile", icon: UserRound },
    { href: "/search-criteria", label: "Search", icon: Search },
  ];
  const secondary: NavItem[] = [
    { href: "/learning", label: "Learning", icon: GraduationCap },
    { href: "/settings", label: "Voice", icon: PenLine },
  ];
  const footer: NavItem[] = [
    { href: "/analytics", label: "Analytics", icon: LineChart },
    { href: "/admin", label: "Admin", icon: Shield },
  ];

  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 flex h-svh w-[264px] shrink-0 flex-col border-r">
      <div className="flex h-[60px] items-center gap-4 px-5">
        <span
          aria-hidden
          className="bg-primary shadow-[0_0_20px_rgba(57,161,133,0.35)] size-3 rounded-md"
        />
        <Link
          href="/"
          className="font-display text-[18px] font-semibold tracking-tight text-[var(--card-foreground)]"
        >
          Optra
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-8 px-3 pb-6">
        <div className="space-y-2">
          <p className="text-muted-foreground px-3.5 pb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Work
          </p>
          {primary.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground px-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Improve
          </p>
          {secondary.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>

        <div className="mt-auto space-y-2">
          <p className="text-muted-foreground px-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
            System
          </p>
          {footer.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>
      </nav>

      <div className="border-sidebar-border space-y-3 border-t px-5 py-4">
        {budgetLabel ? (
          <p className="text-muted-foreground text-[13px] leading-snug">
            {budgetLabel}
          </p>
        ) : null}
        {userEmail ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground truncate text-[12px]">
              {userEmail}
            </p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition-colors"
                title="Log out"
              >
                <LogOut className="size-3.5" />
                Out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
