"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  calendarTasks,
  generatedApps,
  kanbanBoards,
  kanbanColumns,
  kanbanTasks,
  notes,
  spaces,
  userCategories,
  userSettings,
  users,
  whiteboards,
  workspacePages,
  type UserAISettings,
  type UserNotificationSettings,
  type UserPrivacySettings,
} from "@/db/schema";
import { getUserEntitlements, type UserEntitlements } from "@/lib/entitlements";
import { defaultAISettings } from "@/lib/user-settings";
import { syncCurrentUser } from "@/lib/sync-user";

export type CategoryScope = "calendar" | "kanban" | "notes" | "reminders";
export type ThemePreference = "system" | "light" | "dark";
export type DefaultCalendarView = "month" | "week";
export type DefaultTaskPriority = "Low" | "Medium" | "High";

export type SettingsProfileDTO = {
  name: string;
  email: string;
  imageUrl: string;
  initials: string;
};

export type UserSettingsDTO = {
  themePreference: ThemePreference;
  notificationSettings: UserNotificationSettings;
  defaultCalendarView: DefaultCalendarView;
  defaultTaskPriority: DefaultTaskPriority;
  autoSave: boolean;
  aiSettings: UserAISettings;
  privacySettings: UserPrivacySettings;
};

export type UserCategoryDTO = {
  id: number;
  scope: CategoryScope;
  name: string;
  color: string;
  icon: string;
};

export type SettingsPageDTO = {
  profile: SettingsProfileDTO;
  settings: UserSettingsDTO;
  categories: UserCategoryDTO[];
  entitlements: UserEntitlements;
};

export type SettingsInput = UserSettingsDTO;
export type CategoryInput = {
  scope: CategoryScope;
  name: string;
  color: string;
  icon: string;
};

const defaultNotificationSettings: UserNotificationSettings = {
  email: true,
  desktop: true,
  reminders: true,
  weeklyDigest: false,
};

const defaultPrivacySettings: UserPrivacySettings = {
  twoFactorReminder: true,
  showProfileInSharedSpaces: true,
  allowProductAnalytics: false,
};

const defaultSettings: UserSettingsDTO = {
  themePreference: "system",
  notificationSettings: defaultNotificationSettings,
  defaultCalendarView: "month",
  defaultTaskPriority: "Medium",
  autoSave: true,
  aiSettings: defaultAISettings,
  privacySettings: defaultPrivacySettings,
};

const defaultCategories: Array<CategoryInput> = [
  { scope: "calendar", name: "Work", color: "#168f79", icon: "BriefcaseBusiness" },
  { scope: "calendar", name: "Personal", color: "#dc6259", icon: "Heart" },
  { scope: "calendar", name: "Focus", color: "#2d9cdb", icon: "Target" },
  { scope: "calendar", name: "Meeting", color: "#df8a2f", icon: "Users" },
  { scope: "kanban", name: "Roadmap", color: "#8b5cf6", icon: "Map" },
  { scope: "kanban", name: "Sprint", color: "#f4b333", icon: "Zap" },
  { scope: "kanban", name: "Bug", color: "#ef594a", icon: "Bug" },
  { scope: "kanban", name: "Review", color: "#55cdb4", icon: "CheckCircle2" },
  { scope: "notes", name: "Idea", color: "#f4b333", icon: "Lightbulb" },
  { scope: "notes", name: "Research", color: "#2d9cdb", icon: "BookOpen" },
  { scope: "notes", name: "Meeting Notes", color: "#8b5cf6", icon: "NotebookPen" },
  { scope: "notes", name: "Draft", color: "#55cdb4", icon: "FileText" },
  { scope: "reminders", name: "Follow-up", color: "#55cdb4", icon: "MessageCircle" },
  { scope: "reminders", name: "Deadline", color: "#ef594a", icon: "AlarmClock" },
  { scope: "reminders", name: "Personal", color: "#dc6259", icon: "Heart" },
  { scope: "reminders", name: "Habit", color: "#168f79", icon: "Repeat2" },
];

const scopes = new Set<CategoryScope>(["calendar", "kanban", "notes", "reminders"]);
const icons = new Set([
  "AlarmClock",
  "BookOpen",
  "BriefcaseBusiness",
  "Bug",
  "CalendarDays",
  "CheckCircle2",
  "FileText",
  "Flag",
  "Heart",
  "Lightbulb",
  "Map",
  "MessageCircle",
  "NotebookPen",
  "Repeat2",
  "Sparkles",
  "Tag",
  "Target",
  "Users",
  "Zap",
]);

function normalizeText(value: string | undefined, fallback: string, maxLength = 80) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function normalizeColor(value: string | undefined) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ef594a";
}

function normalizeScope(value: string): CategoryScope {
  return scopes.has(value as CategoryScope) ? (value as CategoryScope) : "calendar";
}

function normalizeIcon(value: string | undefined) {
  const icon = normalizeText(value, "Tag", 40);
  return icons.has(icon) ? icon : "Tag";
}

function normalizeSettings(input: SettingsInput): UserSettingsDTO {
  return {
    themePreference: input.themePreference === "light" || input.themePreference === "dark" ? input.themePreference : "system",
    notificationSettings: {
      email: Boolean(input.notificationSettings.email),
      desktop: Boolean(input.notificationSettings.desktop),
      reminders: Boolean(input.notificationSettings.reminders),
      weeklyDigest: Boolean(input.notificationSettings.weeklyDigest),
    },
    defaultCalendarView: input.defaultCalendarView === "week" ? "week" : "month",
    defaultTaskPriority:
      input.defaultTaskPriority === "Low" || input.defaultTaskPriority === "High" ? input.defaultTaskPriority : "Medium",
    autoSave: Boolean(input.autoSave),
    aiSettings: {
      preferredModel: normalizeText(input.aiSettings.preferredModel, defaultAISettings.preferredModel, 80),
      defaultBehavior: normalizeText(input.aiSettings.defaultBehavior, defaultAISettings.defaultBehavior, 40),
      responseTone: normalizeText(input.aiSettings.responseTone, defaultAISettings.responseTone, 40),
      features: {
        aiRefine: Boolean(input.aiSettings.features.aiRefine),
        aiAssistant: Boolean(input.aiSettings.features.aiAssistant),
        aiTemplateBuilder: Boolean(input.aiSettings.features.aiTemplateBuilder),
        aiWhiteboard: Boolean(input.aiSettings.features.aiWhiteboard),
      },
    },
    privacySettings: {
      twoFactorReminder: Boolean(input.privacySettings.twoFactorReminder),
      showProfileInSharedSpaces: Boolean(input.privacySettings.showProfileInSharedSpaces),
      allowProductAnalytics: Boolean(input.privacySettings.allowProductAnalytics),
    },
  };
}

function serializeSettings(row: typeof userSettings.$inferSelect): UserSettingsDTO {
  return normalizeSettings({
    themePreference: row.themePreference as ThemePreference,
    notificationSettings: row.notificationSettings ?? defaultNotificationSettings,
    defaultCalendarView: row.defaultCalendarView as DefaultCalendarView,
    defaultTaskPriority: row.defaultTaskPriority as DefaultTaskPriority,
    autoSave: row.autoSave,
    aiSettings: row.aiSettings ?? defaultAISettings,
    privacySettings: row.privacySettings ?? defaultPrivacySettings,
  });
}

function serializeCategory(row: typeof userCategories.$inferSelect): UserCategoryDTO {
  return {
    id: row.id,
    scope: normalizeScope(row.scope),
    name: row.name,
    color: row.color,
    icon: row.icon,
  };
}

function initialsFrom(name: string, email: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : (parts[0]?.slice(0, 2) ?? email.slice(0, 2));
  return letters.toUpperCase();
}

async function getCurrentSettingsUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage settings.");
  }

  await syncCurrentUser();

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  if (!dbUser) {
    throw new Error("Unable to load your workspace user.");
  }

  return dbUser;
}

async function ensureSettingsSeeded(userId: number) {
  await db
    .insert(userSettings)
    .values({
      userId,
      ...defaultSettings,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: userSettings.userId });

  await db
    .insert(userCategories)
    .values(defaultCategories.map((category) => ({ userId, ...category, updatedAt: new Date() })))
    .onConflictDoNothing();
}

export async function getSettingsPageData(): Promise<SettingsPageDTO> {
  const user = await getCurrentSettingsUser();
  await ensureSettingsSeeded(user.id);

  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  const categories = await db
    .select()
    .from(userCategories)
    .where(eq(userCategories.userId, user.id))
    .orderBy(asc(userCategories.scope), asc(userCategories.name));

  const displayName = user.name ?? user.email;

  return {
    profile: {
      name: displayName,
      email: user.email,
      imageUrl: user.imageUrl ?? "",
      initials: initialsFrom(displayName, user.email),
    },
    settings: settings ? serializeSettings(settings) : defaultSettings,
    categories: categories.map(serializeCategory),
    entitlements: await getUserEntitlements(),
  };
}

export async function listUserCategories(scope?: CategoryScope) {
  const user = await getCurrentSettingsUser();
  await ensureSettingsSeeded(user.id);

  const rows = scope
    ? await db
        .select()
        .from(userCategories)
        .where(and(eq(userCategories.userId, user.id), eq(userCategories.scope, scope)))
        .orderBy(asc(userCategories.name))
    : await db
        .select()
        .from(userCategories)
        .where(eq(userCategories.userId, user.id))
        .orderBy(asc(userCategories.scope), asc(userCategories.name));

  return rows.map(serializeCategory);
}

export async function updateUserSettings(input: SettingsInput) {
  const user = await getCurrentSettingsUser();
  const settings = normalizeSettings(input);

  const [row] = await db
    .insert(userSettings)
    .values({
      userId: user.id,
      ...settings,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        ...settings,
        updatedAt: new Date(),
      },
    })
    .returning();

  revalidatePath("/settings");
  return serializeSettings(row);
}

export async function createUserCategory(input: CategoryInput) {
  const user = await getCurrentSettingsUser();
  const values = {
    userId: user.id,
    scope: normalizeScope(input.scope),
    name: normalizeText(input.name, "New category", 60),
    color: normalizeColor(input.color),
    icon: normalizeIcon(input.icon),
    updatedAt: new Date(),
  };

  const [category] = await db.insert(userCategories).values(values).returning();
  revalidatePath("/settings");
  return serializeCategory(category);
}

export async function updateUserCategory(categoryId: number, input: CategoryInput) {
  const user = await getCurrentSettingsUser();
  const [category] = await db
    .update(userCategories)
    .set({
      scope: normalizeScope(input.scope),
      name: normalizeText(input.name, "New category", 60),
      color: normalizeColor(input.color),
      icon: normalizeIcon(input.icon),
      updatedAt: new Date(),
    })
    .where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, user.id)))
    .returning();

  if (!category) {
    throw new Error("Category not found.");
  }

  revalidatePath("/settings");
  return serializeCategory(category);
}

export async function deleteUserCategory(categoryId: number) {
  const user = await getCurrentSettingsUser();
  await db.delete(userCategories).where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, user.id)));
  revalidatePath("/settings");
}

export async function exportUserData() {
  const user = await getCurrentSettingsUser();
  await ensureSettingsSeeded(user.id);

  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  const categories = await db.select().from(userCategories).where(eq(userCategories.userId, user.id));
  const calendar = await db.select().from(calendarTasks).where(eq(calendarTasks.userId, user.id));
  const boards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, user.id));
  const boardIds = boards.map((board) => board.id);
  const columns = boardIds.length
    ? await db.select().from(kanbanColumns).where(inArray(kanbanColumns.boardId, boardIds))
    : [];
  const columnIds = columns.map((column) => column.id);
  const tasks = columnIds.length ? await db.select().from(kanbanTasks).where(inArray(kanbanTasks.columnId, columnIds)) : [];
  const noteRows = await db.select().from(notes).where(eq(notes.userId, user.id));
  const whiteboardRows = await db.select().from(whiteboards).where(eq(whiteboards.userId, user.id));
  const generatedAppRows = await db.select().from(generatedApps).where(eq(generatedApps.userId, user.id));
  const spaceRows = await db.select().from(spaces).where(eq(spaces.userId, user.id));
  const spaceIds = spaceRows.map((space) => space.id);
  const pageRows = spaceIds.length ? await db.select().from(workspacePages).where(inArray(workspacePages.spaceId, spaceIds)) : [];

  return JSON.parse(
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
      },
      settings,
      categories,
      calendarTasks: calendar,
      kanban: {
        boards,
        columns,
        tasks,
      },
      notes: noteRows,
      whiteboards: whiteboardRows,
      generatedApps: generatedAppRows,
      spaces: {
        spaces: spaceRows,
        pages: pageRows,
      },
    })
  ) as Record<string, unknown>;
}
