"use server";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import { db } from "@/db";
import {
  activityLogs,
  calendarTasks,
  generatedApps,
  kanbanBoardShares,
  kanbanBoards,
  kanbanColumns,
  kanbanTasks,
  notes,
  spaceShares,
  spaces,
  users,
  whiteboards,
  workspacePages,
} from "@/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { getUserAISettings } from "@/lib/user-settings";

export type DashboardFeatureStatus = {
  key: string;
  name: string;
  status: "Active" | "Ready" | "Disabled";
  icon: string;
  color: string;
  stats: Array<{ label: string; value: string }>;
};

export type DashboardActivity = {
  id: string;
  feature: string;
  action: string;
  title: string;
  createdAt: string;
  color: string;
  icon: string;
};

export type DashboardUpcomingItem = {
  id: number;
  title: string;
  dateTime: string;
  category: string;
  categoryColor: string;
  type: "task" | "reminder";
};

export type DashboardRecentPage = {
  id: string;
  title: string;
  type: string;
  href: string;
  color: string;
  icon: string;
  updatedAt: string;
};

export type DashboardTaskSummary = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  progress: number;
};

export type DashboardData = {
  userName: string;
  generatedAt: string;
  features: DashboardFeatureStatus[];
  activities: DashboardActivity[];
  upcoming: DashboardUpcomingItem[];
  recentPages: DashboardRecentPage[];
  taskSummary: DashboardTaskSummary;
  insights: Array<{ title: string; detail: string; color: string; icon: string }>;
};

const featureStyles: Record<string, { color: string; icon: string }> = {
  calendar: { color: "#168f79", icon: "CalendarDays" },
  kanban: { color: "#d08a21", icon: "TableColumnsSplit" },
  notes: { color: "#2d9cdb", icon: "FileText" },
  whiteboard: { color: "#ef594a", icon: "Waypoints" },
  assistant: { color: "#8b5cf6", icon: "Bot" },
  "ai-template-builder": { color: "#db2777", icon: "LayoutTemplate" },
  spaces: { color: "#7c3aed", icon: "Folder" },
};

function todayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(date: string | null, time: string | null) {
  if (!date) {
    return "Unscheduled";
  }

  const parsed = new Date(`${date}T${time ?? "00:00"}`);
  const formattedDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parsed);
  return time ? `${formattedDate}, ${time.slice(0, 5)}` : formattedDate;
}

function formatRelative(value: Date) {
  const diff = Date.now() - value.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function activityStyle(feature: string) {
  return featureStyles[feature] ?? { color: "#6b7280", icon: "Activity" };
}

function completionColumn(name: string) {
  return ["done", "completed"].includes(name.trim().toLowerCase());
}

async function getDashboardUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to view your dashboard.");
  }

  await syncCurrentUser();

  const [dbUser] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  if (!dbUser) {
    throw new Error("Unable to load your workspace user.");
  }

  return {
    ...dbUser,
    email: dbUser.email.trim().toLowerCase(),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await getDashboardUser();
  const currentDate = todayKey();
  const aiSettings = await getUserAISettings(user.id);

  const [
    calendarRows,
    noteRows,
    whiteboardRows,
    generatedAppRows,
    ownedBoards,
    sharedBoardRows,
    ownedSpaces,
    sharedSpaceRows,
    activityRows,
  ] = await Promise.all([
    db.select().from(calendarTasks).where(eq(calendarTasks.userId, user.id)).orderBy(desc(calendarTasks.updatedAt)),
    db.select().from(notes).where(and(eq(notes.userId, user.id), isNull(notes.deletedAt))).orderBy(desc(notes.updatedAt)),
    db.select().from(whiteboards).where(eq(whiteboards.userId, user.id)).orderBy(desc(whiteboards.updatedAt)),
    db.select().from(generatedApps).where(eq(generatedApps.userId, user.id)).orderBy(desc(generatedApps.updatedAt)),
    db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, user.id)).orderBy(desc(kanbanBoards.updatedAt)),
    db.select({ boardId: kanbanBoardShares.boardId }).from(kanbanBoardShares).where(eq(kanbanBoardShares.email, user.email)),
    db.select().from(spaces).where(eq(spaces.userId, user.id)).orderBy(desc(spaces.updatedAt)),
    db.select({ spaceId: spaceShares.spaceId }).from(spaceShares).where(eq(spaceShares.email, user.email)),
    db.select().from(activityLogs).where(eq(activityLogs.userId, user.id)).orderBy(desc(activityLogs.createdAt)).limit(12),
  ]);

  const boardIds = [...new Set([...ownedBoards.map((board) => board.id), ...sharedBoardRows.map((share) => share.boardId)])];
  const boards = boardIds.length
    ? await db.select().from(kanbanBoards).where(inArray(kanbanBoards.id, boardIds)).orderBy(desc(kanbanBoards.updatedAt))
    : [];
  const columns = boardIds.length
    ? await db.select().from(kanbanColumns).where(inArray(kanbanColumns.boardId, boardIds))
    : [];
  const columnIds = columns.map((column) => column.id);
  const tasks = columnIds.length ? await db.select().from(kanbanTasks).where(inArray(kanbanTasks.columnId, columnIds)) : [];

  const spaceIds = [...new Set([...ownedSpaces.map((space) => space.id), ...sharedSpaceRows.map((share) => share.spaceId)])];
  const allSpaces = spaceIds.length
    ? await db.select().from(spaces).where(inArray(spaces.id, spaceIds)).orderBy(desc(spaces.updatedAt))
    : [];
  const pages = spaceIds.length
    ? await db.select().from(workspacePages).where(inArray(workspacePages.spaceId, spaceIds)).orderBy(desc(workspacePages.updatedAt))
    : [];

  const completedColumnIds = new Set(columns.filter((column) => completionColumn(column.name)).map((column) => column.id));
  const completedTasks = tasks.filter((task) => completedColumnIds.has(task.columnId));
  const incompleteTasks = tasks.filter((task) => !completedColumnIds.has(task.columnId));
  const overdueTasks = incompleteTasks.filter((task) => task.dueDate && task.dueDate < currentDate);
  const scheduledCalendar = calendarRows.filter((task) => !task.isDraft && task.scheduledDate);
  const upcoming = scheduledCalendar
    .filter((task) => task.scheduledDate && task.scheduledDate >= currentDate)
    .sort((a, b) => `${a.scheduledDate ?? ""} ${a.scheduledTime ?? ""}`.localeCompare(`${b.scheduledDate ?? ""} ${b.scheduledTime ?? ""}`))
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      dateTime: formatDateTime(task.scheduledDate, task.scheduledTime?.slice(0, 5) ?? null),
      category: task.category,
      categoryColor: task.categoryColor,
      type: task.type === "reminder" ? ("reminder" as const) : ("task" as const),
    }));
  const remindersToday = scheduledCalendar.filter((task) => task.type === "reminder" && task.scheduledDate === currentDate).length;
  const upcomingReminders = scheduledCalendar.filter((task) => task.type === "reminder" && task.scheduledDate && task.scheduledDate >= currentDate).length;
  const calendarDrafts = calendarRows.filter((task) => task.isDraft).length;

  const taskSummary: DashboardTaskSummary = {
    total: tasks.length,
    completed: completedTasks.length,
    pending: incompleteTasks.length,
    overdue: overdueTasks.length,
    progress: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
  };

  const recentPages: DashboardRecentPage[] = [
    ...noteRows.map((note) => ({
      id: `note-${note.id}`,
      title: note.title,
      type: "Note",
      href: "/notes",
      color: note.color,
      icon: note.icon,
      updatedAt: note.updatedAt.toISOString(),
    })),
    ...whiteboardRows.map((board) => ({
      id: `whiteboard-${board.id}`,
      title: board.name,
      type: "Whiteboard",
      href: "/whiteboard",
      color: board.color,
      icon: "Waypoints",
      updatedAt: board.updatedAt.toISOString(),
    })),
    ...boards.map((board) => ({
      id: `kanban-${board.id}`,
      title: board.name,
      type: "Kanban board",
      href: "/kanban",
      color: board.color,
      icon: "TableColumnsSplit",
      updatedAt: board.updatedAt.toISOString(),
    })),
    ...generatedAppRows.map((app) => ({
      id: `template-${app.id}`,
      title: app.appName,
      type: "AI template",
      href: `/ai-template-builder/${app.id}`,
      color: app.color,
      icon: app.icon,
      updatedAt: app.updatedAt.toISOString(),
    })),
    ...pages
      .filter((page) => !page.isArchived)
      .map((page) => ({
        id: `page-${page.id}`,
        title: page.name,
        type: page.template,
        href: "/spaces",
        color: allSpaces.find((space) => space.id === page.spaceId)?.color ?? "#8b5cf6",
        icon: "Folder",
        updatedAt: page.updatedAt.toISOString(),
      })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const derivedActivity: DashboardActivity[] = [
    ...tasks.map((task) => ({
      id: `derived-task-${task.id}`,
      feature: "kanban",
      action: "Updated task",
      title: task.title,
      createdAt: task.updatedAt.toISOString(),
      ...activityStyle("kanban"),
    })),
    ...calendarRows.map((task) => ({
      id: `derived-calendar-${task.id}`,
      feature: "calendar",
      action: task.type === "reminder" ? "Added calendar reminder" : "Created calendar task",
      title: task.title,
      createdAt: task.updatedAt.toISOString(),
      ...activityStyle("calendar"),
    })),
    ...noteRows.map((note) => ({
      id: `derived-note-${note.id}`,
      feature: "notes",
      action: "Updated note",
      title: note.title,
      createdAt: note.updatedAt.toISOString(),
      ...activityStyle("notes"),
    })),
    ...whiteboardRows.map((board) => ({
      id: `derived-whiteboard-${board.id}`,
      feature: "whiteboard",
      action: "Created whiteboard",
      title: board.name,
      createdAt: board.updatedAt.toISOString(),
      ...activityStyle("whiteboard"),
    })),
    ...generatedAppRows.map((app) => ({
      id: `derived-template-${app.id}`,
      feature: "ai-template-builder",
      action: "Generated AI template",
      title: app.appName,
      createdAt: app.updatedAt.toISOString(),
      ...activityStyle("ai-template-builder"),
    })),
  ];

  const loggedActivity = activityRows.map((activity) => ({
    id: `activity-${activity.id}`,
    feature: activity.feature,
    action: activity.action,
    title: activity.title,
    createdAt: activity.createdAt.toISOString(),
    ...activityStyle(activity.feature),
  }));
  const activities = [...loggedActivity, ...derivedActivity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const activeCounts = [
    { label: "Notes", count: noteRows.length },
    { label: "Whiteboards", count: whiteboardRows.length },
    { label: "Kanban", count: tasks.length },
    { label: "Templates", count: generatedAppRows.length },
    { label: "Pages", count: pages.filter((page) => !page.isArchived).length },
  ];
  const mostActive = activeCounts.sort((a, b) => b.count - a.count)[0];

  return {
    userName: user.name ?? user.email.split("@")[0] ?? "there",
    generatedAt: new Date().toISOString(),
    features: [
      {
        key: "calendar",
        name: "Calendar",
        status: scheduledCalendar.length ? "Active" : "Ready",
        icon: "CalendarDays",
        color: featureStyles.calendar.color,
        stats: [
          { label: "Upcoming", value: String(upcoming.length) },
          { label: "Drafts", value: String(calendarDrafts) },
          { label: "Reminders", value: String(upcomingReminders) },
        ],
      },
      {
        key: "kanban",
        name: "Kanban / Tasks",
        status: tasks.length ? "Active" : "Ready",
        icon: "TableColumnsSplit",
        color: featureStyles.kanban.color,
        stats: [
          { label: "Tasks", value: String(tasks.length) },
          { label: "Completed", value: String(completedTasks.length) },
          { label: "Boards", value: String(boards.length) },
        ],
      },
      {
        key: "notes",
        name: "Notes",
        status: noteRows.length ? "Active" : "Ready",
        icon: "FileText",
        color: featureStyles.notes.color,
        stats: [
          { label: "Notes", value: String(noteRows.length) },
          { label: "Pinned", value: String(noteRows.filter((note) => note.isPinned).length) },
          { label: "Latest", value: noteRows[0] ? formatRelative(noteRows[0].updatedAt) : "None" },
        ],
      },
      {
        key: "whiteboard",
        name: "Whiteboard",
        status: whiteboardRows.length ? "Active" : "Ready",
        icon: "Waypoints",
        color: featureStyles.whiteboard.color,
        stats: [
          { label: "Boards", value: String(whiteboardRows.length) },
          { label: "Latest", value: whiteboardRows[0]?.name ?? "None" },
          { label: "Objects", value: String(whiteboardRows.reduce((sum, board) => sum + board.sceneElements.length, 0)) },
        ],
      },
      {
        key: "assistant",
        name: "AI Assistant",
        status: aiSettings.features.aiAssistant ? "Active" : "Disabled",
        icon: "Bot",
        color: featureStyles.assistant.color,
        stats: [
          { label: "Actions", value: String(loggedActivity.filter((item) => item.feature === "assistant").length) },
          { label: "Today", value: String(loggedActivity.filter((item) => item.feature === "assistant" && item.createdAt.slice(0, 10) === currentDate).length) },
          { label: "Tone", value: aiSettings.responseTone },
        ],
      },
      {
        key: "ai-template-builder",
        name: "AI Template Builder",
        status: aiSettings.features.aiTemplateBuilder ? "Active" : "Disabled",
        icon: "LayoutTemplate",
        color: featureStyles["ai-template-builder"].color,
        stats: [
          { label: "Templates", value: String(generatedAppRows.length) },
          { label: "Pinned", value: String(generatedAppRows.filter((app) => app.isSidebarPinned).length) },
          { label: "Status", value: aiSettings.features.aiTemplateBuilder ? "Enabled" : "Off" },
        ],
      },
    ],
    activities,
    upcoming,
    recentPages,
    taskSummary,
    insights: [
      {
        title: overdueTasks.length ? `${overdueTasks.length} overdue tasks` : "No overdue tasks",
        detail: overdueTasks.length ? "Suggested focus: finish high-priority and dated work first." : "Your dated Kanban work is clear right now.",
        color: overdueTasks.length ? "#ef594a" : "#168f79",
        icon: overdueTasks.length ? "AlarmClock" : "CheckCircle2",
      },
      {
        title: `Most active: ${mostActive?.label ?? "Workspace"}`,
        detail: mostActive?.count ? `${mostActive.count} recent or active items are in this area.` : "Start with a note, task, or reminder to build momentum.",
        color: "#8b5cf6",
        icon: "Sparkles",
      },
      {
        title: `${taskSummary.progress}% task completion`,
        detail: taskSummary.total ? `${taskSummary.completed} of ${taskSummary.total} tasks are complete.` : "Create your first Kanban task to start tracking progress.",
        color: "#d08a21",
        icon: "Target",
      },
      {
        title: `${remindersToday} reminders today`,
        detail: upcoming.length ? "Your next scheduled items are waiting in Upcoming." : "No upcoming calendar items are scheduled yet.",
        color: "#2d9cdb",
        icon: "Bell",
      },
    ],
  };
}
