import {
  Activity,
  AlarmClock,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  Folder,
  LayoutTemplate,
  Lightbulb,
  NotebookPen,
  PenLine,
  Plus,
  Sparkles,
  TableColumnsSplit,
  Target,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { getDashboardData, type DashboardData } from "@/app/dashboard/actions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const iconMap = {
  Activity,
  AlarmClock,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  Folder,
  LayoutTemplate,
  Lightbulb,
  NotebookPen,
  PenLine,
  Plus,
  Sparkles,
  TableColumnsSplit,
  Target,
  Waypoints,
};

const quickActions = [
  {
    title: "Create Task",
    href: "/kanban",
    detail: "Add work to a board",
    icon: TableColumnsSplit,
    color: "#d08a21",
  },
  {
    title: "Add Calendar Reminder",
    href: "/calendar",
    detail: "Schedule the next thing",
    icon: CalendarDays,
    color: "#168f79",
  },
  {
    title: "Create Note",
    href: "/notes",
    detail: "Capture a thought",
    icon: FileText,
    color: "#2d9cdb",
  },
  {
    title: "Open Whiteboard",
    href: "/whiteboard",
    detail: "Map ideas visually",
    icon: Waypoints,
    color: "#ef594a",
  },
  {
    title: "Ask AI Assistant",
    href: "/assistant",
    detail: "Route a request",
    icon: Bot,
    color: "#8b5cf6",
  },
  {
    title: "Generate AI Template",
    href: "/ai-template-builder",
    detail: "Build a mini app",
    icon: LayoutTemplate,
    color: "#db2777",
  },
];

function DashboardIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = iconMap[name as keyof typeof iconMap] ?? Activity;
  return <Icon className={className} style={style} aria-hidden="true" />;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-5 py-8 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-[#8a867d]" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-[#292524]">{title}</p>
      <p className="mx-auto mt-2 max-w-[300px] text-sm font-semibold leading-6 text-[#6b675f]">{detail}</p>
    </div>
  );
}

function getStatValue(feature: DashboardData["features"][number], label: string) {
  return feature.stats.find((stat) => stat.label === label)?.value ?? "0";
}

function pluralize(value: string, singular: string, plural = `${singular}s`) {
  return `${value} ${Number(value) === 1 ? singular : plural}`;
}

function featureCopy(feature: DashboardData["features"][number]) {
  if (feature.key === "calendar") {
    return {
      headline: pluralize(getStatValue(feature, "Upcoming"), "upcoming item", "upcoming items"),
      detail: `${getStatValue(feature, "Drafts")} drafts saved`,
    };
  }

  if (feature.key === "kanban") {
    return {
      headline: pluralize(getStatValue(feature, "Tasks"), "task"),
      detail: `${getStatValue(feature, "Completed")} completed across ${getStatValue(feature, "Boards")} boards`,
    };
  }

  if (feature.key === "notes") {
    return {
      headline: pluralize(getStatValue(feature, "Notes"), "note"),
      detail: `${getStatValue(feature, "Pinned")} pinned notes ready`,
    };
  }

  if (feature.key === "whiteboard") {
    const latest = getStatValue(feature, "Latest");
    return {
      headline: pluralize(getStatValue(feature, "Boards"), "board"),
      detail: latest === "None" ? "No boards opened yet" : `Latest: ${latest}`,
    };
  }

  if (feature.key === "assistant") {
    return {
      headline: pluralize(getStatValue(feature, "Actions"), "action"),
      detail: `${getStatValue(feature, "Today")} today`,
    };
  }

  return {
    headline: pluralize(getStatValue(feature, "Templates"), "template"),
    detail: `${getStatValue(feature, "Pinned")} sidebar apps pinned`,
  };
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ErrorDashboard({ message }: { message: string }) {
  return (
    <AppShell>
      <section className="grid min-h-[60vh] place-items-center">
        <Card className="w-full max-w-[560px] rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#fff0ed] text-[#944139]">
              <AlarmClock className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="pt-3 text-2xl font-bold text-[#111827]">Dashboard needs your workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold leading-7 text-[#6b675f]">{message}</p>
            <Button asChild className="mt-5 bg-[#ef594a] font-bold text-white hover:bg-[#dc4d40]">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function FeatureStatusGrid({ data }: { data: DashboardData }) {
  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {data.features.map((feature) => {
        const copy = featureCopy(feature);

        return (
          <Card
            key={feature.key}
            className="rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]"
          >
            <CardContent className="p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${feature.color}18` }}>
                <DashboardIcon name={feature.icon} className="h-5 w-5" style={{ color: feature.color }} />
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-xs font-black",
                  feature.status === "Disabled" ? "bg-[#f3eee4] text-[#77736b]" : "text-[#292524]"
                )}
                style={feature.status === "Disabled" ? undefined : { backgroundColor: `${feature.color}18`, color: feature.color }}
              >
                {feature.status}
              </span>
            </div>
            <div className="mt-7">
              <p className="text-lg font-black text-[#171717]">{feature.name}</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-[#111827]">{copy.headline}</p>
              <p className="mt-2 text-sm font-bold text-[#6b675f]">{copy.detail}</p>
            </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function QuickActions() {
  return (
    <Card className="rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-black text-[#171717]">
          <span className="text-[#d85749]">-&gt;</span>
          Quick access
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.title}
                href={action.href}
                className="group rounded-lg border border-[#e1d8c8] bg-[#fffaf0] p-4 shadow-[0_1px_2px_rgba(44,38,31,0.08)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                style={{ borderLeft: `5px solid ${action.color}` }}
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${action.color}18` }}>
                    <Icon className="h-5 w-5" style={{ color: action.color }} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[#292524]">{action.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#6b675f]">{action.detail}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
function TaskSummary({ data }: { data: DashboardData }) {
  const summary = data.taskSummary;

  return (
    <Card className="rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-black text-[#171717]">
          <Target className="h-5 w-5 text-[#d08a21]" aria-hidden="true" />
          Task summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {[
            ["Total", summary.total],
            ["Completed", summary.completed],
            ["Pending", summary.pending],
            ["Overdue", summary.overdue],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[#e8dfcf] bg-[#fffaf0] p-5">
              <p className="text-sm font-bold text-[#6b675f]">{label}</p>
              <p className="mt-3 text-3xl font-black text-[#111827]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-base font-black text-[#292524]">Progress</p>
            <p className="text-base font-black text-[#6b675f]">{summary.progress}%</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#f1eadf]">
            <div className="h-full rounded-full bg-[#ef594a]" style={{ width: `${summary.progress}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingCalendar({ data }: { data: DashboardData }) {
  return (
    <Card className="rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-black text-[#171717]">
          <CalendarDays className="h-5 w-5 text-[#168f79]" aria-hidden="true" />
          Upcoming calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.upcoming.length ? (
          <div className="space-y-4">
            {data.upcoming.map((item) => (
              <div key={item.id} className="rounded-lg border border-[#e8dfcf] bg-[#fffaf0] p-5">
                <div className="flex items-center gap-4">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: item.categoryColor }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-[#292524]">{item.title}</p>
                    <p className="mt-1 text-sm font-bold text-[#6b675f]">{item.dateTime}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black capitalize text-[#6b675f]">{item.type}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming calendar items" detail="Add a task or reminder on the Calendar page to see it here." />
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ data }: { data: DashboardData }) {
  return (
    <Card className="rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-black text-[#171717]">
          <Activity className="h-5 w-5 text-[#ef594a]" aria-hidden="true" />
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.activities.length ? (
          <div className="space-y-5">
            {data.activities.map((item) => (
              <div key={item.id} className="flex items-start gap-4">
                <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[#292524]">{item.title}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#6b675f]">
                    {item.action} · {formatUpdated(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No activity yet" detail="Create a note, task, reminder, whiteboard, or template to start the feed." />
        )}
      </CardContent>
    </Card>
  );
}

function RecentPages({ data }: { data: DashboardData }) {
  return (
    <Card className="rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-black text-[#171717]">
          <Folder className="h-5 w-5 text-[#7c3aed]" aria-hidden="true" />
          Recent pages
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.recentPages.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.recentPages.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block min-w-0 rounded-lg border border-[#e8dfcf] bg-[#fffaf0] p-5 transition hover:border-[#ef594a] hover:bg-white"
                style={{ borderLeft: `5px solid ${item.color}` }}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="truncate text-base font-black text-[#292524]">{item.title}</p>
                  <span className="shrink-0 rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
                    {item.type}
                  </span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-[#6b675f]">Updated {formatUpdated(item.updatedAt)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent pages" detail="Open or update notes, boards, templates, whiteboards, or workspace pages." />
        )}
      </CardContent>
    </Card>
  );
}

function AIInsights({ data }: { data: DashboardData }) {
  return (
    <Card className="rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-black text-[#171717]">
          <Sparkles className="h-5 w-5 text-[#8b5cf6]" aria-hidden="true" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.insights.map((insight, index) => (
            <div key={insight.title} className="rounded-lg border border-[#e8dfcf] bg-[#fffaf0] p-5">
              <div className="flex items-center gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#ece5ff] text-sm font-black text-[#7c3aed]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold text-[#403c37]">{insight.title}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#6b675f]">{insight.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export async function DashboardLayout() {
  let data: DashboardData;

  try {
    data = await getDashboardData();
  } catch (error) {
    return <ErrorDashboard message={error instanceof Error ? error.message : "Unable to load your dashboard."} />;
  }

  return (
    <AppShell>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e1d8c8] pb-8">
        <div className="max-w-4xl">
          <p className="flex items-center gap-2 text-sm font-bold text-[#d85749]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#111827] lg:text-4xl">
            Welcome back, {data.userName}.
          </h1>
          <p className="mt-3 text-base font-medium leading-7 text-[#5f5b55]">
            A live overview of your tasks, schedule, notes, whiteboards, and AI-powered work.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="h-11 border-[#e1d8c8] bg-white font-bold text-[#403c37] shadow-sm hover:border-[#ef594a]">
            <Link href="/calendar">
              <CalendarDays className="mr-2 h-4 w-4 text-[#168f79]" aria-hidden="true" />
              Calendar
            </Link>
          </Button>
          <Button asChild className="h-11 bg-[#ef594a] font-bold text-white shadow-sm hover:bg-[#dc4d40]">
            <Link href="/kanban">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New task
            </Link>
          </Button>
        </div>
      </header>

      <div className="mt-7 space-y-7">
        <FeatureStatusGrid data={data} />
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <QuickActions />
          <TaskSummary data={data} />
        </section>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <UpcomingCalendar data={data} />
          <RecentActivity data={data} />
        </section>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <RecentPages data={data} />
          <AIInsights data={data} />
        </section>
      </div>
    </AppShell>
  );
}
