"use client";

import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  LayoutTemplate,
  Plus,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  TableColumnsSplit,
  Users,
  Waypoints,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type MenuItem = {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  active?: boolean;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    label: "HOME",
    items: [
      { label: "Dashboard", icon: Home, color: "text-[#e85b4f]", active: true },
      { label: "AI Assistant", icon: Bot, color: "text-violet-500" },
      { label: "Calendar", icon: CalendarDays, color: "text-teal-500" },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { label: "Task / Kanban", icon: TableColumnsSplit, color: "text-amber-600" },
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

const stats = [
  { label: "Open tasks", value: "24", chip: "bg-[#fee2df] text-[#90433b]" },
  { label: "Notes drafted", value: "18", chip: "bg-[#d7f8ee] text-[#386f61]" },
  { label: "Spaces active", value: "7", chip: "bg-[#ffefbd] text-[#8a6321]" },
  { label: "AI templates", value: "12", chip: "bg-[#ece5ff] text-[#6b3bc3]" },
];

const pulseItems = [
  { title: "Design review", meta: "Today", border: "border-l-[#f06454]" },
  { title: "Sprint notes", meta: "2 drafts", border: "border-l-[#55cdb4]" },
  { title: "Whiteboard ideas", meta: "14 objects", border: "border-l-[#f4b333]" },
];

const activities = [
  "Product roadmap board updated",
  "AI summarized weekly planning notes",
  "Calendar focus block moved to 2:00 PM",
];

function SidebarMenuItem({ item, collapsed }: { item: MenuItem; collapsed: boolean }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[14px] font-semibold text-[#57534e] transition",
        "hover:bg-[#dff8f3] hover:text-[#1f2937]",
        collapsed && "justify-center px-0",
        item.active && "bg-[#fee4df] text-[#c94d42]"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", item.color)} aria-hidden="true" />
      <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>{item.label}</span>
    </button>
  );
}

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="min-h-screen bg-[#fbf6ea] text-[#111827]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 flex h-screen shrink-0 flex-col border-r border-[#e8dfcf] bg-[#fffaf0] px-4 py-4 transition-[width] duration-300",
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
                    <SidebarMenuItem key={item.label} item={item} collapsed={collapsed} />
                  ))}
                </div>
              </section>
            ))}
          </nav>

          <footer className="mt-4">
            <div
              className={cn(
                "flex items-center gap-3 rounded-md p-1",
                collapsed && "justify-center"
              )}
            >
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

        <section className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-7">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e1d8c8] pb-8">
            <div className="max-w-4xl">
              <p className="text-sm font-bold text-[#d85749]">Dashboard</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#111827] lg:text-4xl">
                Plan, write, and map your work in one calm place.
              </h1>
              <p className="mt-3 text-base font-medium text-[#5f5b55]">
                A focused home for tasks, notes, whiteboards, pages, and AI-assisted workflows.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex h-11 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]">
                <CalendarDays className="h-4 w-4 text-teal-600" aria-hidden="true" />
                Today
              </button>
              <button className="flex h-11 items-center gap-2 rounded-md bg-[#ef594a] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New space
              </button>
            </div>
          </header>

          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-[0_1px_2px_rgba(44,38,31,0.08)]"
              >
                <span className={cn("rounded-md px-3 py-1 text-xs font-bold", stat.chip)}>
                  {stat.label}
                </span>
                <p className="mt-6 text-4xl font-bold tracking-tight text-[#111827]">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <section className="rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
              <h2 className="text-xl font-bold text-[#171717]">Workspace pulse</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {pulseItems.map((item) => (
                  <div
                    key={item.title}
                    className={cn(
                      "rounded-md border border-[#e8dfcf] border-l-4 bg-[#fff9ee] p-4",
                      item.border
                    )}
                  >
                    <p className="font-bold text-[#292524]">{item.title}</p>
                    <p className="mt-2 text-sm font-medium text-[#6b675f]">{item.meta}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
              <h2 className="text-xl font-bold text-[#171717]">Recent activity</h2>
              <div className="mt-5 space-y-4">
                {activities.map((activity) => (
                  <div key={activity} className="flex items-center gap-3 text-[15px] font-medium text-[#5f5b55]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ef594a]" aria-hidden="true" />
                    <span>{activity}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_1.35fr]">
            <section className="rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
              <h2 className="text-xl font-bold text-[#171717]">Pinned notes</h2>
              <div className="mt-5 rounded-md border border-[#e8dfcf] bg-[#fff9ee] p-5">
                <p className="text-lg font-bold text-[#292524]">Launch narrative</p>
                <p className="mt-4 text-base leading-7 text-[#5f5b55]">
                  Tighten the product story around focused teams, visual planning, and AI templates.
                </p>
              </div>
              <div className="mt-4 rounded-md border border-[#e8dfcf] bg-white p-5">
                <p className="text-lg font-bold text-[#292524]">Research synthesis</p>
                <p className="mt-4 text-base leading-7 text-[#5f5b55]">
                  Convert interview highlights into themes for next week&apos;s planning session.
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
              <h2 className="text-xl font-bold text-[#171717]">Whiteboard preview</h2>
              <div className="relative mt-5 h-[260px] overflow-hidden rounded-md border border-[#e8dfcf] bg-[radial-gradient(circle_at_1px_1px,#e8dfcf_1px,transparent_0)] [background-size:22px_22px]">
                <div className="absolute left-9 top-10 rounded-md border border-[#f0c7c1] bg-[#f9d7d2] px-7 py-5 text-sm font-bold text-[#7c423c]">
                  Ideas
                </div>
                <div className="absolute left-[190px] top-[116px] rounded-md border border-[#c9eadf] bg-[#dbf7ef] px-7 py-5 text-sm font-bold text-[#386f61]">
                  Tasks
                </div>
                <div className="absolute right-12 top-12 rounded-md border border-[#eadc9b] bg-[#fff0bd] px-7 py-5 text-sm font-bold text-[#7c6227]">
                  Launch
                </div>
                <div className="absolute left-[126px] top-[90px] h-px w-[112px] rotate-[24deg] bg-[#d8cdbb]" />
                <div className="absolute right-[176px] top-[94px] h-px w-[136px] -rotate-[18deg] bg-[#d8cdbb]" />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
