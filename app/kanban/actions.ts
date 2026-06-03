"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { calendarTasks, kanbanBoards, kanbanColumns, kanbanTasks, users } from "@/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";

export type KanbanPriority = "Low" | "Medium" | "High";

export type KanbanLabel = {
  name: string;
  color: string;
};

export type KanbanTaskDTO = {
  id: number;
  columnId: number;
  title: string;
  description: string;
  dueDate: string;
  priority: KanbanPriority;
  labels: KanbanLabel[];
  syncCalendar: boolean;
  linkNotes: boolean;
  linkedCalendarTaskId: number | null;
  position: number;
};

export type KanbanColumnDTO = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  tasks: KanbanTaskDTO[];
};

export type KanbanBoardDTO = {
  id: number;
  name: string;
  color: string;
  columns: KanbanColumnDTO[];
};

export type KanbanTaskInput = {
  title: string;
  description?: string;
  dueDate?: string;
  priority: KanbanPriority;
  labels?: KanbanLabel[];
  syncCalendar?: boolean;
  linkNotes?: boolean;
};

const defaultColumns = ["Todo", "In Progress", "Done"];
const maxColumnsPerBoard = 5;

function requireText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeDate(value?: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizePriority(value: KanbanPriority): KanbanPriority {
  return value === "Low" || value === "High" ? value : "Medium";
}

function normalizeLabels(labels?: KanbanLabel[]) {
  return (labels ?? [])
    .map((label) => ({
      name: label.name.trim(),
      color: normalizeColor(label.color, "#55cdb4"),
    }))
    .filter((label) => label.name)
    .slice(0, 6);
}

function serializeTask(task: typeof kanbanTasks.$inferSelect): KanbanTaskDTO {
  return {
    id: task.id,
    columnId: task.columnId,
    title: task.title,
    description: task.description ?? "",
    dueDate: task.dueDate ?? "",
    priority: normalizePriority(task.priority as KanbanPriority),
    labels: Array.isArray(task.labels) ? task.labels : [],
    syncCalendar: task.syncCalendar,
    linkNotes: task.linkNotes,
    linkedCalendarTaskId: task.linkedCalendarTaskId,
    position: task.position,
  };
}

async function getCurrentUserId() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage Kanban boards.");
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

async function requireBoard(userId: number, boardId: number) {
  const [board] = await db
    .select()
    .from(kanbanBoards)
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error("Board not found.");
  }

  return board;
}

async function requireColumn(userId: number, columnId: number) {
  const [column] = await db
    .select({
      id: kanbanColumns.id,
      boardId: kanbanColumns.boardId,
      name: kanbanColumns.name,
      position: kanbanColumns.position,
    })
    .from(kanbanColumns)
    .innerJoin(kanbanBoards, eq(kanbanBoards.id, kanbanColumns.boardId))
    .where(and(eq(kanbanColumns.id, columnId), eq(kanbanBoards.userId, userId)))
    .limit(1);

  if (!column) {
    throw new Error("Column not found.");
  }

  return column;
}

async function requireTask(userId: number, taskId: number) {
  const [task] = await db
    .select({
      id: kanbanTasks.id,
      columnId: kanbanTasks.columnId,
      title: kanbanTasks.title,
      description: kanbanTasks.description,
      dueDate: kanbanTasks.dueDate,
      priority: kanbanTasks.priority,
      labels: kanbanTasks.labels,
      syncCalendar: kanbanTasks.syncCalendar,
      linkNotes: kanbanTasks.linkNotes,
      linkedCalendarTaskId: kanbanTasks.linkedCalendarTaskId,
      position: kanbanTasks.position,
      boardId: kanbanColumns.boardId,
    })
    .from(kanbanTasks)
    .innerJoin(kanbanColumns, eq(kanbanColumns.id, kanbanTasks.columnId))
    .innerJoin(kanbanBoards, eq(kanbanBoards.id, kanbanColumns.boardId))
    .where(and(eq(kanbanTasks.id, taskId), eq(kanbanBoards.userId, userId)))
    .limit(1);

  if (!task) {
    throw new Error("Task not found.");
  }

  return task;
}

async function nextTaskPosition(columnId: number) {
  const tasks = await db
    .select({ position: kanbanTasks.position })
    .from(kanbanTasks)
    .where(eq(kanbanTasks.columnId, columnId))
    .orderBy(desc(kanbanTasks.position))
    .limit(1);

  return (tasks[0]?.position ?? -1) + 1;
}

async function syncCalendarTask(userId: number, task: typeof kanbanTasks.$inferSelect) {
  if (!task.syncCalendar || !task.dueDate) {
    return task.linkedCalendarTaskId;
  }

  const calendarPayload = {
    userId,
    title: task.title,
    description: task.description,
    type: "task",
    category: "Kanban",
    categoryColor: "#f4b333",
    scheduledDate: task.dueDate,
    scheduledTime: null,
    isDraft: false,
    updatedAt: new Date(),
  };

  if (task.linkedCalendarTaskId) {
    const [updatedTask] = await db
      .update(calendarTasks)
      .set(calendarPayload)
      .where(and(eq(calendarTasks.id, task.linkedCalendarTaskId), eq(calendarTasks.userId, userId)))
      .returning({ id: calendarTasks.id });

    if (updatedTask) {
      return updatedTask.id;
    }
  }

  const [createdTask] = await db.insert(calendarTasks).values(calendarPayload).returning({
    id: calendarTasks.id,
  });

  return createdTask.id;
}

export async function listKanbanBoards() {
  const userId = await getCurrentUserId();
  const boards = await db
    .select()
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId))
    .orderBy(asc(kanbanBoards.createdAt));

  if (!boards.length) {
    return [];
  }

  const boardIds = boards.map((board) => board.id);
  const columns = await db
    .select()
    .from(kanbanColumns)
    .where(inArray(kanbanColumns.boardId, boardIds))
    .orderBy(asc(kanbanColumns.position));
  const columnIds = columns.map((column) => column.id);
  const tasks = columnIds.length
    ? await db
        .select()
        .from(kanbanTasks)
        .where(inArray(kanbanTasks.columnId, columnIds))
        .orderBy(asc(kanbanTasks.position))
    : [];

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    color: board.color,
    columns: columns
      .filter((column) => column.boardId === board.id)
      .map((column) => ({
        id: column.id,
        boardId: column.boardId,
        name: column.name,
        position: column.position,
        tasks: tasks.filter((task) => task.columnId === column.id).map(serializeTask),
      })),
  }));
}

export async function createKanbanBoard(input: { name: string; color: string }) {
  const userId = await getCurrentUserId();
  const [board] = await db
    .insert(kanbanBoards)
    .values({
      userId,
      name: requireText(input.name, "Untitled board"),
      color: normalizeColor(input.color, "#ef594a"),
      updatedAt: new Date(),
    })
    .returning();

  const columns = await db
    .insert(kanbanColumns)
    .values(
      defaultColumns.map((name, position) => ({
        boardId: board.id,
        name,
        position,
        updatedAt: new Date(),
      }))
    )
    .returning();

  revalidatePath("/kanban");

  return {
    id: board.id,
    name: board.name,
    color: board.color,
    columns: columns.map((column) => ({
      id: column.id,
      boardId: column.boardId,
      name: column.name,
      position: column.position,
      tasks: [],
    })),
  };
}

export async function updateKanbanBoard(boardId: number, input: { name: string; color: string }) {
  const userId = await getCurrentUserId();
  await requireBoard(userId, boardId);

  const [board] = await db
    .update(kanbanBoards)
    .set({
      name: requireText(input.name, "Untitled board"),
      color: normalizeColor(input.color, "#ef594a"),
      updatedAt: new Date(),
    })
    .where(eq(kanbanBoards.id, boardId))
    .returning();

  revalidatePath("/kanban");

  return {
    id: board.id,
    name: board.name,
    color: board.color,
    columns: [],
  };
}

export async function deleteKanbanBoard(boardId: number) {
  const userId = await getCurrentUserId();
  await requireBoard(userId, boardId);

  await db.delete(kanbanBoards).where(eq(kanbanBoards.id, boardId));
  revalidatePath("/kanban");
}

export async function createKanbanColumn(boardId: number, name: string) {
  const userId = await getCurrentUserId();
  await requireBoard(userId, boardId);
  const columns = await db.select().from(kanbanColumns).where(eq(kanbanColumns.boardId, boardId));

  if (columns.length >= maxColumnsPerBoard) {
    throw new Error("Each board can have up to 5 columns.");
  }

  const [column] = await db
    .insert(kanbanColumns)
    .values({
      boardId,
      name: requireText(name, "New column"),
      position: columns.length,
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/kanban");

  return {
    id: column.id,
    boardId: column.boardId,
    name: column.name,
    position: column.position,
    tasks: [],
  };
}

export async function updateKanbanColumn(columnId: number, name: string) {
  const userId = await getCurrentUserId();
  await requireColumn(userId, columnId);

  const [column] = await db
    .update(kanbanColumns)
    .set({ name: requireText(name, "Untitled column"), updatedAt: new Date() })
    .where(eq(kanbanColumns.id, columnId))
    .returning();

  revalidatePath("/kanban");

  return {
    id: column.id,
    boardId: column.boardId,
    name: column.name,
    position: column.position,
    tasks: [],
  };
}

export async function deleteKanbanColumn(columnId: number) {
  const userId = await getCurrentUserId();
  await requireColumn(userId, columnId);

  await db.delete(kanbanColumns).where(eq(kanbanColumns.id, columnId));
  revalidatePath("/kanban");
}

export async function createKanbanTask(columnId: number, input: KanbanTaskInput) {
  const userId = await getCurrentUserId();
  await requireColumn(userId, columnId);

  const [task] = await db
    .insert(kanbanTasks)
    .values({
      columnId,
      title: requireText(input.title, "Untitled task"),
      description: input.description?.trim() || null,
      dueDate: normalizeDate(input.dueDate),
      priority: normalizePriority(input.priority),
      labels: normalizeLabels(input.labels),
      syncCalendar: Boolean(input.syncCalendar),
      linkNotes: Boolean(input.linkNotes),
      position: await nextTaskPosition(columnId),
      updatedAt: new Date(),
    })
    .returning();

  const linkedCalendarTaskId = await syncCalendarTask(userId, task);
  const finalTask =
    linkedCalendarTaskId !== task.linkedCalendarTaskId
      ? (
          await db
            .update(kanbanTasks)
            .set({ linkedCalendarTaskId, updatedAt: new Date() })
            .where(eq(kanbanTasks.id, task.id))
            .returning()
        )[0]
      : task;

  revalidatePath("/kanban");
  revalidatePath("/calendar");
  return serializeTask(finalTask);
}

export async function updateKanbanTask(taskId: number, input: KanbanTaskInput) {
  const userId = await getCurrentUserId();
  await requireTask(userId, taskId);

  const [task] = await db
    .update(kanbanTasks)
    .set({
      title: requireText(input.title, "Untitled task"),
      description: input.description?.trim() || null,
      dueDate: normalizeDate(input.dueDate),
      priority: normalizePriority(input.priority),
      labels: normalizeLabels(input.labels),
      syncCalendar: Boolean(input.syncCalendar),
      linkNotes: Boolean(input.linkNotes),
      updatedAt: new Date(),
    })
    .where(eq(kanbanTasks.id, taskId))
    .returning();

  const linkedCalendarTaskId = await syncCalendarTask(userId, task);
  const finalTask =
    linkedCalendarTaskId !== task.linkedCalendarTaskId
      ? (
          await db
            .update(kanbanTasks)
            .set({ linkedCalendarTaskId, updatedAt: new Date() })
            .where(eq(kanbanTasks.id, task.id))
            .returning()
        )[0]
      : task;

  revalidatePath("/kanban");
  revalidatePath("/calendar");
  return serializeTask(finalTask);
}

export async function deleteKanbanTask(taskId: number) {
  const userId = await getCurrentUserId();
  await requireTask(userId, taskId);

  await db.delete(kanbanTasks).where(eq(kanbanTasks.id, taskId));
  revalidatePath("/kanban");
}

export async function moveKanbanTask(taskId: number, columnId: number, position: number) {
  const userId = await getCurrentUserId();
  await requireTask(userId, taskId);
  await requireColumn(userId, columnId);

  const [task] = await db
    .update(kanbanTasks)
    .set({
      columnId,
      position,
      updatedAt: new Date(),
    })
    .where(eq(kanbanTasks.id, taskId))
    .returning();

  revalidatePath("/kanban");
  return serializeTask(task);
}
