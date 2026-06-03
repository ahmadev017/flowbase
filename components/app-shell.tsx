"use client";

import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  LayoutTemplate,
  Search,
  Settings,
  Sparkles,
  TableColumnsSplit,
  Users,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

type MenuItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    label: "HOME",
    items: [
      { label: "Dashboard", href: "/", icon: Home, color: "text-[#e85b4f]" },
      { label: "AI Assistant", icon: Bot, color: "text-violet-500" },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, color: "text-teal-500" },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { label: "Task / Kanban", href: "/kanban", icon: TableColumnsSplit, color: "text-amber-600" },
      { label: "Notes", icon: FileText, color: "text-sky-600" },
      { label: "Whiteboard", icon: Waypoints, color: "text-rose-500" },
      { label: "Pages / Spaces", icon: Users, color: "text-emerald-600" },
    ],
  },
  {
    label: "BUILD",
    items: [
      { label: "AI Template Builder", icon: LayoutTemplate, color: "text-pink-600" },
      { label: "Settings", icon: Settings, color: "text-slate-500" },
    ],
  },
];

function SidebarMenuItem({
  item,
  collapsed,
  active,
}: {
  item: MenuItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  const className = cn(
    "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[14px] font-semibold text-[#57534e] transition",
    "hover:bg-[#dff8f3] hover:text-[#1f2937]",
    collapsed && "justify-center px-0",
    active && "bg-[#fee4df] text-[#c94d42]"
  );
  const content = (
    <>
      <Icon className={cn("h-4 w-4 shrink-0", item.color)} aria-hidden="true" />
      <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>{item.label}</span>
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-label={item.label}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={className}
    >
      {content}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#fbf6ea] text-[#111827]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#e8dfcf] bg-[#fffaf0] px-4 py-4 transition-[width] duration-300 md:flex",
            collapsed ? "w-16" : "w-[260px]"
          )}
        >
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ef594a] text-white shadow-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className={cn("min-w-0", collapsed && "sr-only")}>
              <p className="truncate text-[15px] font-bold leading-5 text-[#111827]">Flowbase</p>
              <p className="truncate text-[13px] font-medium text-[#6b675f]">Cozy workspace</p>
            </div>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <div
              className={cn(
                "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-3 text-[13px] font-medium text-[#77736b] shadow-sm",
                collapsed && "hidden"
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-[#77736b]" aria-hidden="true" />
              <span className="truncate">Search everything</span>
            </div>
          </div>

          <nav className="mt-7 flex-1 space-y-6 overflow-y-auto">
            {menuGroups.map((group) => (
              <section key={group.label} className="space-y-2">
                <p
                  className={cn(
                    "px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a867d]",
                    collapsed && "sr-only"
                  )}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <SidebarMenuItem
                      key={item.label}
                      item={item}
                      collapsed={collapsed}
                      active={item.href === "/" ? pathname === "/" : pathname === item.href}
                    />
                  ))}
                </div>
              </section>
            ))}
          </nav>

          <footer className="mt-4">
            <div className={cn("flex items-center gap-3 rounded-md p-1", collapsed && "justify-center")}>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#24211f] text-lg font-semibold text-white shadow-sm">
                N
              </div>
              <div className={cn("min-w-0", collapsed && "sr-only")}>
                <p className="truncate text-sm font-semibold text-[#292524]">Nova team</p>
                <p className="truncate text-xs text-[#77736b]">Personal plan</p>
              </div>
            </div>
          </footer>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-7">
          <div className="mb-5 rounded-lg border border-[#e1d8c8] bg-[#fffaf0] p-3 shadow-sm md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ef594a] text-white shadow-sm">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold leading-5 text-[#111827]">Flowbase</p>
                  <p className="truncate text-[13px] font-medium text-[#6b675f]">Cozy workspace</p>
                </div>
              </div>
            </div>
            <nav className="mt-3 grid grid-cols-2 gap-2">
              {menuGroups
                .flatMap((group) => group.items)
                .filter((item) => item.href)
                .map((item) => {
                  const Icon = item.icon;
                  const active = item.href === "/" ? pathname === "/" : pathname === item.href;

                  return (
                    <Link
                      key={item.label}
                      href={item.href ?? "/"}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-3 text-sm font-bold text-[#57534e]",
                        active && "border-[#f0c7c1] bg-[#fee4df] text-[#c94d42]"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", item.color)} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
