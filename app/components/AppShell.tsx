"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  GraduationCap,
  Home,
  Mail,
  Paperclip,
  School,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants/app";
import { NotificationBell } from "./NotificationBell";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/admissions", label: "Admissions", icon: School },
  { href: "/applications", label: "Outreach", icon: Mail },
  { href: "/sop", label: "SOPs", icon: FileText },
  { href: "/attachments", label: "Files", icon: Paperclip },
];

const BARE_ROUTES = ["/login", "/signup"];

// One NotificationBell at a time: each instance polls and mounts its own dialog.
const desktopQuery = "(min-width: 768px)";
function subscribeDesktop(cb: () => void) {
  const mql = window.matchMedia(desktopQuery);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
const useIsDesktop = () =>
  useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => false);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();

  if (BARE_ROUTES.includes(pathname)) return <>{children}</>;

  const settingsActive = isActive(pathname, "/settings");

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-muted/30 pl-[env(safe-area-inset-left)] md:flex">
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          <Link href="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-[18px] w-[18px]" aria-hidden />
            </span>
            {APP_NAME}
          </Link>
          {isDesktop && <NotificationBell />}
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="border-t px-3 py-3">
          <SidebarLink item={{ href: "/settings", label: "Settings", icon: Settings }} active={settingsActive} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
        <div className="flex h-14 items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" aria-hidden />
            </span>
            {APP_NAME}
          </Link>
          <div className="flex items-center">
            {!isDesktop && <NotificationBell />}
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md transition-colors active:bg-accent",
                settingsActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0 md:pl-60">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-full select-none flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out motion-safe:group-active:scale-90",
                      active && "bg-secondary"
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {item.label}
    </Link>
  );
}
