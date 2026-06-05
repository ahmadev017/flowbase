import { boolean, date, integer, jsonb, pgTable, serial, text, time, timestamp, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  name: text("name"),
  email: text("email").notNull().unique(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserAISettings = {
  preferredModel: string;
  defaultBehavior: string;
  responseTone: string;
  features: {
    aiRefine: boolean;
    aiAssistant: boolean;
    aiTemplateBuilder: boolean;
    aiWhiteboard: boolean;
  };
};

export type UserNotificationSettings = {
  email: boolean;
  desktop: boolean;
  reminders: boolean;
  weeklyDigest: boolean;
};

export type UserPrivacySettings = {
  twoFactorReminder: boolean;
  showProfileInSharedSpaces: boolean;
  allowProductAnalytics: boolean;
};

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  themePreference: text("theme_preference").notNull().default("system"),
  notificationSettings: jsonb("notification_settings").$type<UserNotificationSettings>().default({
    email: true,
    desktop: true,
    reminders: true,
    weeklyDigest: false,
  }).notNull(),
  defaultCalendarView: text("default_calendar_view").notNull().default("month"),
  defaultTaskPriority: text("default_task_priority").notNull().default("Medium"),
  autoSave: boolean("auto_save").default(true).notNull(),
  aiSettings: jsonb("ai_settings").$type<UserAISettings>().default({
    preferredModel: "gemini-2.5-flash",
    defaultBehavior: "balanced",
    responseTone: "friendly",
    features: {
      aiRefine: true,
      aiAssistant: true,
      aiTemplateBuilder: true,
      aiWhiteboard: true,
    },
  }).notNull(),
  privacySettings: jsonb("privacy_settings").$type<UserPrivacySettings>().default({
    twoFactorReminder: true,
    showProfileInSharedSpaces: true,
    allowProductAnalytics: false,
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userSettingsUserUnique: unique("user_settings_user_unique").on(table.userId),
}));

export const userCategories = pgTable("user_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#ef594a"),
  icon: text("icon").notNull().default("Tag"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userCategoryScopeNameUnique: unique("user_categories_user_scope_name_unique").on(table.userId, table.scope, table.name),
}));

export const calendarTasks = pgTable("calendar_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("task"),
  category: text("category").notNull(),
  categoryColor: text("category_color").notNull(),
  scheduledDate: date("scheduled_date"),
  scheduledTime: time("scheduled_time"),
  isDraft: boolean("is_draft").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanBoards = pgTable("kanban_boards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanBoardShares = pgTable(
  "kanban_board_shares",
  {
    id: serial("id").primaryKey(),
    boardId: integer("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    role: text("role").notNull().default("editor"),
    invitedByUserId: integer("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    boardEmailUnique: unique("kanban_board_shares_board_email_unique").on(table.boardId, table.email),
  })
);

export const kanbanColumns = pgTable("kanban_columns", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => kanbanBoards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanTasks = pgTable("kanban_tasks", {
  id: serial("id").primaryKey(),
  columnId: integer("column_id")
    .notNull()
    .references(() => kanbanColumns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  priority: text("priority").notNull().default("Medium"),
  labels: jsonb("labels").$type<Array<{ name: string; color: string }>>().default([]).notNull(),
  syncCalendar: boolean("sync_calendar").default(false).notNull(),
  linkNotes: boolean("link_notes").default(false).notNull(),
  linkedCalendarTaskId: integer("linked_calendar_task_id").references(() => calendarTasks.id, {
    onDelete: "set null",
  }),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: jsonb("content")
    .$type<Record<string, unknown>>()
    .default({
      type: "doc",
      content: [{ type: "paragraph" }],
    })
    .notNull(),
  color: text("color").notNull().default("#55cdb4"),
  icon: text("icon").notNull().default("FileText"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whiteboards = pgTable("whiteboards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#ef594a"),
  sceneElements: jsonb("scene_elements").$type<unknown[]>().default([]).notNull(),
  appState: jsonb("app_state").$type<Record<string, unknown>>().default({}).notNull(),
  files: jsonb("files").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GeneratedAppSchema = {
  appName: string;
  description: string;
  icon: string;
  color: string;
  layout: "single-page";
  sections: Array<{
    id: string;
    title: string;
    description?: string;
    components: Array<{
      id: string;
      type: "stats" | "list" | "table" | "form" | "progress" | "checklist" | "buttons" | "tags" | "chart" | "calculator";
      title: string;
      description?: string;
      fields?: Array<{ label: string; type?: string; placeholder?: string; value?: string }>;
      items?: Array<Record<string, unknown>>;
      actions?: Array<{ label: string; variant?: "primary" | "secondary" }>;
    }>;
  }>;
  actions: Array<{ label: string; variant?: "primary" | "secondary" }>;
  sampleData: Array<Record<string, unknown>>;
};

export const generatedApps = pgTable("generated_apps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  appName: text("app_name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("LayoutTemplate"),
  color: text("color").notNull().default("#ef594a"),
  layout: text("layout").notNull().default("single-page"),
  schema: jsonb("schema").$type<GeneratedAppSchema>().notNull(),
  isSidebarPinned: boolean("is_sidebar_pinned").default(false).notNull(),
  sidebarPosition: integer("sidebar_position"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const spaces = pgTable("spaces", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#8b5cf6"),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  lastOpenedAt: timestamp("last_opened_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const spaceShares = pgTable(
  "space_shares",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    role: text("role").notNull().default("editor"),
    invitedByUserId: integer("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    spaceEmailUnique: unique("space_shares_space_email_unique").on(table.spaceId, table.email),
  })
);

export const workspacePages = pgTable("workspace_pages", {
  id: serial("id").primaryKey(),
  spaceId: integer("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  template: text("template").notNull().default("Blank Page"),
  description: text("description").notNull().default(""),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  commentsCount: integer("comments_count").default(0).notNull(),
  linkedTasksCount: integer("linked_tasks_count").default(0).notNull(),
  lastEditedBy: text("last_edited_by").notNull().default("You"),
  lastEditedByInitials: text("last_edited_by_initials").notNull().default("ME"),
  content: jsonb("content")
    .$type<Record<string, unknown>>()
    .default({ text: "" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ActivityMetadata = Record<string, unknown>;

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  action: text("action").notNull(),
  title: text("title").notNull(),
  metadata: jsonb("metadata").$type<ActivityMetadata>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type UserCategory = typeof userCategories.$inferSelect;
export type NewUserCategory = typeof userCategories.$inferInsert;
export type CalendarTask = typeof calendarTasks.$inferSelect;
export type NewCalendarTask = typeof calendarTasks.$inferInsert;
export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type NewKanbanBoard = typeof kanbanBoards.$inferInsert;
export type KanbanBoardShare = typeof kanbanBoardShares.$inferSelect;
export type NewKanbanBoardShare = typeof kanbanBoardShares.$inferInsert;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type KanbanTask = typeof kanbanTasks.$inferSelect;
export type NewKanbanTask = typeof kanbanTasks.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Whiteboard = typeof whiteboards.$inferSelect;
export type NewWhiteboard = typeof whiteboards.$inferInsert;
export type GeneratedApp = typeof generatedApps.$inferSelect;
export type NewGeneratedApp = typeof generatedApps.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type SpaceShare = typeof spaceShares.$inferSelect;
export type NewSpaceShare = typeof spaceShares.$inferInsert;
export type WorkspacePage = typeof workspacePages.$inferSelect;
export type NewWorkspacePage = typeof workspacePages.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
