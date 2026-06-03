"use server";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { calendarTasks, kanbanBoardShares, kanbanBoards, kanbanColumns, kanbanTasks, users } from "@/db/schema";
import { ensureKanbanRoom, grantKanbanRoomAccess, normalizeEmail } from "@/lib/liveblocks";
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

export type BoardCollaboratorDTO = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  color: string;
  status: "owner" | "active" | "pending";
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

type CurrentWorkspaceUser = {
  id: number;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

function getCollaboratorColor(value: string) {
  const colors = ["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259"];
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return colors[hash % colors.length];
}

async function getCurrentWorkspaceUser(): Promise<CurrentWorkspaceUser> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage Kanban boards.");
  }

  await syncCurrentUser();

  const [dbUser] = await db
    .select({ id: users.id, email: users.email, name: users.name, imageUrl: users.imageUrl })
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  if (!dbUser) {
    throw new Error("Unable to load your workspace user.");
  }

  const email = normalizeEmail(dbUser.email);

  await db
    .update(kanbanBoardShares)
    .set({ userId: dbUser.id, acceptedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(kanbanBoardShares.email, email), isNull(kanbanBoardShares.userId)));

  return { ...dbUser, email };
}

async function requireBoard(user: CurrentWorkspaceUser, boardId: number) {
  const [board] = await db
    .select()
    .from(kanbanBoards)
    .where(eq(kanbanBoards.id, boardId))
    .limit(1);

  if (!board) {
    throw new Error("Board not found.");
  }

  if (board.userId === user.id) {
    return board;
  }

  const [share] = await db
    .select({ id: kanbanBoardShares.id })
    .from(kanbanBoardShares)
    .where(and(eq(kanbanBoardShares.boardId, boardId), eq(kanbanBoardShares.email, user.email)))
    .limit(1);

  if (!share) {
    throw new Error("Board not found.");
  }

  return board;
}

async function requireColumn(user: CurrentWorkspaceUser, columnId: number) {
  const [column] = await db
    .select({
      id: kanbanColumns.id,
      boardId: kanbanColumns.boardId,
      name: kanbanColumns.name,
      position: kanbanColumns.position,
    })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.id, columnId))
    .limit(1);

  if (!column) {
    throw new Error("Column not found.");
  }

  await requireBoard(user, column.boardId);

  return column;
}

async function requireTask(user: CurrentWorkspaceUser, taskId: number) {
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
    .where(eq(kanbanTasks.id, taskId))
    .limit(1);

  if (!task) {
    throw new Error("Task not found.");
  }

  await requireBoard(user, task.boardId);

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
  const user = await getCurrentWorkspaceUser();
  const ownedBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, user.id));
  const sharedRows = await db
    .select({ boardId: kanbanBoardShares.boardId })
    .from(kanbanBoardShares)
    .where(eq(kanbanBoardShares.email, user.email));
  const boardIds = [...new Set([...ownedBoards.map((board) => board.id), ...sharedRows.map((share) => share.boardId)])];
  const boards = boardIds.length
    ? await db.select().from(kanbanBoards).where(inArray(kanbanBoards.id, boardIds)).orderBy(asc(kanbanBoards.createdAt))
    : [];

  if (!boards.length) {
    return [];
  }

  const ownerIds = [...new Set(boards.map((board) => board.userId))];
  const boardOwners = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, ownerIds));

  await Promise.all(
    boards.map(async (board) => {
      const ownerEmail = boardOwners.find((owner) => owner.id === board.userId)?.email ?? user.email;
      await ensureKanbanRoom({ id: board.id, name: board.name, userEmail: ownerEmail });

      if (board.userId !== user.id) {
        await grantKanbanRoomAccess(board.id, user.email);
      }
    })
  );

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
  const user = await getCurrentWorkspaceUser();
  const [board] = await db
    .insert(kanbanBoards)
    .values({
      userId: user.id,
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

  await ensureKanbanRoom({ id: board.id, name: board.name, userEmail: user.email });

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
  const user = await getCurrentWorkspaceUser();
  const currentBoard = await requireBoard(user, boardId);

  const [board] = await db
    .update(kanbanBoards)
    .set({
      name: requireText(input.name, "Untitled board"),
      color: normalizeColor(input.color, "#ef594a"),
      updatedAt: new Date(),
    })
    .where(eq(kanbanBoards.id, boardId))
    .returning();

  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, currentBoard.userId)).limit(1);
  await ensureKanbanRoom({ id: board.id, name: board.name, userEmail: owner?.email ?? user.email });

  revalidatePath("/kanban");

  return {
    id: board.id,
    name: board.name,
    color: board.color,
    columns: [],
  };
}

export async function deleteKanbanBoard(boardId: number) {
  const user = await getCurrentWorkspaceUser();
  await requireBoard(user, boardId);

  await db.delete(kanbanBoards).where(eq(kanbanBoards.id, boardId));
  revalidatePath("/kanban");
}

export async function createKanbanColumn(boardId: number, name: string) {
  const user = await getCurrentWorkspaceUser();
  await requireBoard(user, boardId);
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
  const user = await getCurrentWorkspaceUser();
  await requireColumn(user, columnId);

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
  const user = await getCurrentWorkspaceUser();
  await requireColumn(user, columnId);

  await db.delete(kanbanColumns).where(eq(kanbanColumns.id, columnId));
  revalidatePath("/kanban");
}

export async function createKanbanTask(columnId: number, input: KanbanTaskInput) {
  const user = await getCurrentWorkspaceUser();
  await requireColumn(user, columnId);

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

  const linkedCalendarTaskId = await syncCalendarTask(user.id, task);
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
  const user = await getCurrentWorkspaceUser();
  await requireTask(user, taskId);

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

  const linkedCalendarTaskId = await syncCalendarTask(user.id, task);
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
  const user = await getCurrentWorkspaceUser();
  await requireTask(user, taskId);

  await db.delete(kanbanTasks).where(eq(kanbanTasks.id, taskId));
  revalidatePath("/kanban");
}

export async function moveKanbanTask(taskId: number, columnId: number, position: number) {
  const user = await getCurrentWorkspaceUser();
  await requireTask(user, taskId);
  await requireColumn(user, columnId);

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

export async function listBoardCollaborators(boardId: number): Promise<BoardCollaboratorDTO[]> {
  const user = await getCurrentWorkspaceUser();
  const board = await requireBoard(user, boardId);

  const [owner] = await db.select().from(users).where(eq(users.id, board.userId)).limit(1);
  const shares = await db
    .select()
    .from(kanbanBoardShares)
    .where(eq(kanbanBoardShares.boardId, boardId))
    .orderBy(asc(kanbanBoardShares.createdAt));
  const shareUserIds = shares.map((share) => share.userId).filter((id): id is number => Boolean(id));
  const sharedUsers = shareUserIds.length
    ? await db.select().from(users).where(inArray(users.id, shareUserIds))
    : [];

  return [
    ...(owner
      ? [
          {
            id: `owner-${owner.id}`,
            name: owner.name ?? owner.email,
            email: owner.email,
            imageUrl: owner.imageUrl ?? "",
            color: getCollaboratorColor(owner.email),
            status: "owner" as const,
          },
        ]
      : []),
    ...shares.map((share) => {
      const sharedUser = sharedUsers.find((item) => item.id === share.userId);
      const email = normalizeEmail(share.email);

      return {
        id: `share-${share.id}`,
        name: sharedUser?.name ?? email,
        email,
        imageUrl: sharedUser?.imageUrl ?? "",
        color: getCollaboratorColor(email),
        status: share.acceptedAt ? ("active" as const) : ("pending" as const),
      };
    }),
  ];
}

export async function inviteBoardCollaborator(boardId: number, email: string): Promise<BoardCollaboratorDTO[]> {
  const user = await getCurrentWorkspaceUser();
  const board = await requireBoard(user, boardId);
  const normalizedEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (normalizedEmail === user.email || existingUser?.id === board.userId) {
    throw new Error("That user already has access to this board.");
  }

  await db
    .insert(kanbanBoardShares)
    .values({
      boardId,
      email: normalizedEmail,
      userId: existingUser?.id ?? null,
      role: "editor",
      invitedByUserId: user.id,
      acceptedAt: existingUser ? new Date() : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [kanbanBoardShares.boardId, kanbanBoardShares.email],
      set: {
        userId: existingUser?.id ?? null,
        role: "editor",
        invitedByUserId: user.id,
        acceptedAt: existingUser ? new Date() : null,
        updatedAt: new Date(),
      },
    });

  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, board.userId)).limit(1);
  await ensureKanbanRoom({ id: board.id, name: board.name, userEmail: owner?.email ?? user.email });
  await grantKanbanRoomAccess(boardId, normalizedEmail);

  revalidatePath("/kanban");
  return listBoardCollaborators(boardId);
}
