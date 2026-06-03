"use server";

import { and, desc, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { calendarTasks, users } from "@/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";

export type CalendarTaskType = "task" | "reminder";

export type CalendarTaskDTO = {
  id: number;
  title: string;
  description: string;
  type: CalendarTaskType;
  category: string;
  categoryColor: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  isDraft: boolean;
};

export type CalendarTaskInput = {
  title: string;
  description?: string;
  type: CalendarTaskType;
  category: string;
  categoryColor: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  isDraft?: boolean;
};

function serializeTask(task: typeof calendarTasks.$inferSelect): CalendarTaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    type: task.type === "reminder" ? "reminder" : "task",
    category: task.category,
    categoryColor: task.categoryColor,
    scheduledDate: task.scheduledDate,
    scheduledTime: task.scheduledTime?.slice(0, 5) ?? null,
    isDraft: task.isDraft,
  };
}

function requireText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeTime(value?: string | null) {
  return value && /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function normalizeDate(value?: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function getCurrentUserId() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage calendar tasks.");
  }

  await syncCurrentUser();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  if (!dbUser) {
    throw new Error("Unable to load your workspace user.");
  }

  return dbUser.id;
}

export async function listCalendarTasks() {
  const userId = await getCurrentUserId();
  const tasks = await db
    .select()
    .from(calendarTasks)
    .where(eq(calendarTasks.userId, userId))
    .orderBy(desc(calendarTasks.createdAt));

  return tasks.map(serializeTask);
}

export async function createCalendarTask(input: CalendarTaskInput) {
  const userId = await getCurrentUserId();
  const isDraft = Boolean(input.isDraft);
  const scheduledDate = isDraft ? null : normalizeDate(input.scheduledDate);

  const [task] = await db
    .insert(calendarTasks)
    .values({
      userId,
      title: requireText(input.title, "Untitled task"),
      description: input.description?.trim() || null,
      type: input.type === "reminder" ? "reminder" : "task",
      category: requireText(input.category, "General"),
      categoryColor: requireText(input.categoryColor, "#ef594a"),
      scheduledDate,
      scheduledTime: normalizeTime(input.scheduledTime),
      isDraft,
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/calendar");
  return serializeTask(task);
}

export async function updateCalendarTask(taskId: number, input: CalendarTaskInput) {
  const userId = await getCurrentUserId();
  const isDraft = Boolean(input.isDraft);

  const [task] = await db
    .update(calendarTasks)
    .set({
      title: requireText(input.title, "Untitled task"),
      description: input.description?.trim() || null,
      type: input.type === "reminder" ? "reminder" : "task",
      category: requireText(input.category, "General"),
      categoryColor: requireText(input.categoryColor, "#ef594a"),
      scheduledDate: isDraft ? null : normalizeDate(input.scheduledDate),
      scheduledTime: normalizeTime(input.scheduledTime),
      isDraft,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarTasks.id, taskId), eq(calendarTasks.userId, userId)))
    .returning();

  if (!task) {
    throw new Error("Task not found.");
  }

  revalidatePath("/calendar");
  return serializeTask(task);
}

export async function scheduleCalendarTask(taskId: number, scheduledDate: string) {
  const userId = await getCurrentUserId();
  const [task] = await db
    .update(calendarTasks)
    .set({
      scheduledDate: normalizeDate(scheduledDate),
      isDraft: false,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarTasks.id, taskId), eq(calendarTasks.userId, userId)))
    .returning();

  if (!task) {
    throw new Error("Task not found.");
  }

  revalidatePath("/calendar");
  return serializeTask(task);
}
