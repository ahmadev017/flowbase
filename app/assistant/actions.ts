"use server";

import { GoogleGenAI } from "@google/genai";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { createCalendarTask } from "@/app/calendar/actions";
import {
  createKanbanTask,
  listKanbanBoards,
  type KanbanPriority,
} from "@/app/kanban/actions";
import { createNote, listNotes, refineSelectedText, updateNote, type NoteContent, type RefineOperation } from "@/app/notes/actions";
import { getSettingsPageData, listUserCategories, updateUserSettings } from "@/app/settings/actions";
import { createWhiteboard, generateWhiteboardDiagram } from "@/app/whiteboard/actions";
import { generateTemplateApp } from "@/app/ai-template-builder/actions";
import { db } from "@/db";
import { kanbanBoards, kanbanColumns, kanbanTasks } from "@/db/schema";
import { getCurrentWorkspaceUserId, getUserAISettings } from "@/lib/user-settings";

export type AssistantHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantPendingAction =
  | {
      type: "update_ai_settings";
      label: string;
      updates: Partial<{
        preferredModel: string;
        defaultBehavior: string;
        responseTone: string;
        features: Partial<{
          aiRefine: boolean;
          aiAssistant: boolean;
          aiTemplateBuilder: boolean;
          aiWhiteboard: boolean;
        }>;
      }>;
    };

export type AssistantTurnInput = {
  message: string;
  history?: AssistantHistoryMessage[];
  confirmedAction?: AssistantPendingAction;
};

export type AssistantTurnResult = {
  message: string;
  actionSummary?: string;
  pendingAction?: AssistantPendingAction;
};

type Intent =
  | { type: "chat"; reply?: string }
  | { type: "create_kanban_board"; boardName?: string; color?: string; columns?: string[] }
  | {
      type: "create_kanban_board_with_task";
      boardName?: string;
      color?: string;
      columns?: string[];
      taskTitle?: string;
      taskDescription?: string;
      columnName?: string;
      dueDate?: string;
      priority?: KanbanPriority;
    }
  | { type: "add_kanban_column"; boardName?: string; columnName?: string }
  | {
      type: "add_kanban_task";
      title?: string;
      description?: string;
      dueDate?: string;
      priority?: KanbanPriority;
      boardName?: string;
      columnName?: string;
      labels?: Array<{ name: string; color: string }>;
      syncCalendar?: boolean;
    }
  | {
      type: "create_calendar_task";
      title?: string;
      description?: string;
      taskType?: "task" | "reminder";
      scheduledDate?: string;
      scheduledTime?: string;
      category?: string;
    }
  | { type: "create_note"; title?: string; content?: string }
  | { type: "summarize_note"; noteTitle?: string; content?: string }
  | { type: "refine_note"; text?: string; operation?: RefineOperation; tone?: "friendly" | "professional" | "confident" | "casual" }
  | { type: "create_whiteboard_prompt"; prompt?: string; name?: string }
  | { type: "generate_template_app"; prompt?: string }
  | {
      type: "update_ai_settings";
      confirmationText?: string;
      updates?: AssistantPendingAction["updates"];
    };

const allowedPriorities = new Set<KanbanPriority>(["Low", "Medium", "High"]);
const allowedRefineOperations = new Set<RefineOperation>([
  "Improve grammar",
  "Rephrase",
  "Make shorter",
  "Make longer",
  "Simplify language",
  "Change tone",
]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeColor(value: unknown, fallback = "#ef594a") {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function normalizeTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : "";
}

function tiptapDocFromText(text: string): NoteContent {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    }));

  return {
    type: "doc",
    content: paragraphs.length ? paragraphs : [{ type: "paragraph" }],
  };
}

function textFromNoteContent(content: NoteContent) {
  const stack = Array.isArray(content.content) ? [...content.content] : [];
  const parts: string[] = [];

  while (stack.length) {
    const node = stack.shift() as { text?: string; content?: unknown[] };
    if (node.text) {
      parts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      stack.push(...node.content);
    }
  }

  return parts.join(" ").trim();
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as Intent;
}

function parseListPhrase(value: string) {
  return value
    .split(/\s*(?:,| and | & |\+)\s*/i)
    .map((item) => item.trim().replace(/^columns?\s+/i, ""))
    .filter(Boolean);
}

function lastAssistantAskedForBoardName(history: AssistantHistoryMessage[] = []) {
  const lastAssistantMessage = [...history].reverse().find((item) => item.role === "assistant")?.content ?? "";

  return /what.*(?:call|name).*kanban board|what.*name.*new board|what.*like to name.*board/i.test(lastAssistantMessage);
}

function cleanBoardNameFromReply(message: string) {
  return cleanText(message)
    .replace(/^(?:my\s+)?(?:new\s+)?(?:kanban\s+)?board\s+(?:should\s+be|is|name\s+is|called|named)\s+/i, "")
    .replace(/^(?:it\s+)?(?:should\s+be|is|called|named)\s+/i, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function parseKanbanShortcut(message: string, history: AssistantHistoryMessage[] = []): Intent | null {
  const normalized = message.trim();

  const compoundBoardTaskMatch = normalized.match(
    /\b(?:create|make|add|build)\s+(?:a\s+)?(?:new\s+)?(?:kanban\s+)?board(?:\s+(?:called|named|title[d]?|for))?\s+(.+?)\s+(?:and\s+also\s+|and\s+)?(?:add|create)\s+(?:a\s+)?task\s+(?:called|named)?\s*(.+?)(?:\s+(?:in|to|under|inside)\s+(?:the\s+)?(.+?)\s+columns?)?\s*$/i
  );

  if (compoundBoardTaskMatch) {
    return {
      type: "create_kanban_board_with_task",
      boardName: cleanBoardNameFromReply(compoundBoardTaskMatch[1]),
      taskTitle: cleanText(compoundBoardTaskMatch[2]),
      columnName: cleanText(compoundBoardTaskMatch[3]),
      columns: normalizeColumnNames([
        "Todo",
        cleanText(compoundBoardTaskMatch[3], "In Progress"),
        "Done",
      ]),
    };
  }

  if (lastAssistantAskedForBoardName(history)) {
    const boardName = cleanBoardNameFromReply(normalized);

    if (boardName) {
      const columnMatch = normalized.match(/\b(?:with|and)\s+(?:a\s+)?columns?\s+(?:called|named)?\s*(.+)$/i);

      return {
        type: "create_kanban_board",
        boardName,
        columns: parseListPhrase(columnMatch?.[1] ?? ""),
      };
    }
  }

  if (!/\bkanban\b/i.test(normalized)) {
    return null;
  }

  const boardMatch = normalized.match(
    /\b(?:create|make|add|build)\s+(?:a\s+)?(?:new\s+)?(?:kanban\s+)?board(?:\s+(?:called|named|title[d]?|for))?\s+(.+?)(?=\s+with\s+(?:a\s+)?columns?\b|\s+and\s+(?:add\s+)?(?:a\s+)?columns?\b|$)/i
  );

  if (boardMatch) {
    const boardName = cleanText(boardMatch[1]).replace(/^named\s+/i, "");
    const columnMatch = normalized.match(/\bwith\s+(?:a\s+)?columns?\s+(?:called|named)?\s*(.+)$/i);
    const andColumnMatch = normalized.match(/\band\s+(?:add\s+)?(?:a\s+)?columns?\s+(?:called|named)?\s*(.+)$/i);
    const columns = parseListPhrase(columnMatch?.[1] ?? andColumnMatch?.[1] ?? "");

    return {
      type: "create_kanban_board",
      boardName: cleanBoardNameFromReply(boardName),
      columns,
    };
  }

  const addColumnMatch = normalized.match(
    /\b(?:add|create|make)\s+(?:a\s+)?columns?\s+(?:called|named)?\s*(.+?)\s+(?:to|in|on)\s+(?:the\s+)?(?:kanban\s+)?board\s+(?:called|named)?\s*(.+)$/i
  );

  if (addColumnMatch) {
    return {
      type: "add_kanban_column",
      columnName: cleanText(addColumnMatch[1]),
      boardName: cleanText(addColumnMatch[2]),
    };
  }

  return null;
}

function splitBoardNameTaskInstruction(boardName: string): Intent | null {
  const match = boardName.match(
    /^(.+?)\s+(?:and\s+also\s+|and\s+)?(?:add|create)\s+(?:a\s+)?task\s+(?:called|named)?\s*(.+?)(?:\s+(?:in|to|under|inside)\s+(?:the\s+)?(.+?)\s+columns?)?\s*$/i
  );

  if (!match) {
    return null;
  }

  return {
    type: "create_kanban_board_with_task",
    boardName: cleanBoardNameFromReply(match[1]),
    taskTitle: cleanText(match[2]),
    columnName: cleanText(match[3]),
    columns: normalizeColumnNames(["Todo", cleanText(match[3], "In Progress"), "Done"]),
  };
}

type AssistantKanbanBoard = {
  id: number;
  name: string;
  columns: Array<{
    id: number;
    name: string;
  }>;
};

const defaultAssistantKanbanColumns = ["Todo", "In Progress", "Done"];

function normalizeBoardName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120) || "Untitled board";
}

function normalizeColumnNames(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim().replace(/\s+/g, " ").slice(0, 80))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

async function getOwnedAssistantKanbanBoards(userId: number) {
  const boards = await db
    .select({ id: kanbanBoards.id, name: kanbanBoards.name, color: kanbanBoards.color })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId))
    .orderBy(asc(kanbanBoards.createdAt));
  const boardIds = boards.map((board) => board.id);
  const columns = boardIds.length
    ? await db
        .select({ id: kanbanColumns.id, boardId: kanbanColumns.boardId, name: kanbanColumns.name })
        .from(kanbanColumns)
        .where(eq(kanbanColumns.boardId, boardIds[0]))
        .orderBy(asc(kanbanColumns.position))
    : [];

  return Promise.all(
    boards.map(async (board) => {
      const boardColumns =
        board.id === boardIds[0]
          ? columns
          : await db
              .select({ id: kanbanColumns.id, boardId: kanbanColumns.boardId, name: kanbanColumns.name })
              .from(kanbanColumns)
              .where(eq(kanbanColumns.boardId, board.id))
              .orderBy(asc(kanbanColumns.position));

      return {
        ...board,
        columns: boardColumns,
      };
    })
  );
}

async function createAssistantKanbanBoard(input: { name: string; color?: string; columns?: string[] }) {
  const userId = await getCurrentWorkspaceUserId();
  const boardName = normalizeBoardName(input.name);
  const ownedBoards = await getOwnedAssistantKanbanBoards(userId);
  const existingBoard = ownedBoards.find((board) => board.name.toLowerCase() === boardName.toLowerCase());
  const requestedColumns = normalizeColumnNames(input.columns ?? []);

  if (existingBoard) {
    const addedColumns = await addAssistantKanbanColumns(existingBoard, requestedColumns);
    return {
      board: existingBoard,
      created: false,
      columns: addedColumns,
    };
  }

  const [board] = await db
    .insert(kanbanBoards)
    .values({
      userId,
      name: boardName,
      color: normalizeColor(input.color, "#f4b333"),
      updatedAt: new Date(),
    })
    .returning({ id: kanbanBoards.id, name: kanbanBoards.name, color: kanbanBoards.color });
  const columnNames =
    requestedColumns.length > 1
      ? requestedColumns
      : [...defaultAssistantKanbanColumns, ...requestedColumns.filter((column) => !defaultAssistantKanbanColumns.some((item) => item.toLowerCase() === column.toLowerCase()))].slice(0, 5);

  const createdColumns = await db
    .insert(kanbanColumns)
    .values(
      columnNames.map((name, position) => ({
        boardId: board.id,
        name,
        position,
        updatedAt: new Date(),
      }))
    )
    .returning({ id: kanbanColumns.id, boardId: kanbanColumns.boardId, name: kanbanColumns.name });

  revalidatePath("/kanban");

  return {
    board: { ...board, columns: createdColumns },
    created: true,
    columns: createdColumns.map((column) => column.name),
  };
}

async function addAssistantKanbanColumns(board: AssistantKanbanBoard, columns: string[]) {
  const requestedColumns = normalizeColumnNames(columns);
  const existingNames = new Set(board.columns.map((column) => column.name.toLowerCase()));
  const availableSlots = Math.max(0, 5 - board.columns.length);
  const columnsToAdd = requestedColumns
    .filter((column) => !existingNames.has(column.toLowerCase()))
    .slice(0, availableSlots);

  if (!columnsToAdd.length) {
    return [];
  }

  const createdColumns = await db
    .insert(kanbanColumns)
    .values(
      columnsToAdd.map((name, index) => ({
        boardId: board.id,
        name,
        position: board.columns.length + index,
        updatedAt: new Date(),
      }))
    )
    .returning({ name: kanbanColumns.name });

  revalidatePath("/kanban");
  return createdColumns.map((column) => column.name);
}

async function addAssistantKanbanColumn(input: { boardName?: string; columnName: string }) {
  const userId = await getCurrentWorkspaceUserId();
  const boards = await getOwnedAssistantKanbanBoards(userId);
  const board = findByName(boards, input.boardName) ?? (boards.length === 1 ? boards[0] : null);

  if (!board) {
    return {
      message: boards.length
        ? `Which board should I add the column to? I found: ${boards.map((item) => item.name).join(", ")}.`
        : "You do not have a Kanban board yet. Tell me a board name and I can create one first.",
    };
  }

  if (board.columns.length >= 5) {
    return { message: `"${board.name}" already has the maximum of 5 columns.` };
  }

  const [column] = await db
    .insert(kanbanColumns)
    .values({
      boardId: board.id,
      name: normalizeColumnNames([input.columnName])[0] ?? "New column",
      position: board.columns.length,
      updatedAt: new Date(),
    })
    .returning({ name: kanbanColumns.name });

  revalidatePath("/kanban");

  return {
    message: `Added "${column.name}" to the "${board.name}" board.`,
    actionSummary: "Kanban column added",
  };
}

async function createAssistantKanbanTask(input: {
  columnId: number;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: KanbanPriority;
}) {
  const [positionRow] = await db
    .select({ position: kanbanTasks.position })
    .from(kanbanTasks)
    .where(eq(kanbanTasks.columnId, input.columnId))
    .orderBy(asc(kanbanTasks.position));
  const [task] = await db
    .insert(kanbanTasks)
    .values({
      columnId: input.columnId,
      title: cleanText(input.title, "Untitled task"),
      description: cleanText(input.description) || null,
      dueDate: normalizeDate(input.dueDate) || null,
      priority: allowedPriorities.has(input.priority as KanbanPriority) ? (input.priority as KanbanPriority) : "Medium",
      labels: [],
      syncCalendar: false,
      linkNotes: false,
      position: (positionRow?.position ?? -1) + 1,
      updatedAt: new Date(),
    })
    .returning({ title: kanbanTasks.title });

  revalidatePath("/kanban");
  return task;
}

async function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const userId = await getCurrentWorkspaceUserId();
  const aiSettings = await getUserAISettings(userId);

  if (!aiSettings.features.aiAssistant) {
    throw new Error("AI Assistant is disabled in Settings.");
  }

  return {
    ai: new GoogleGenAI({ apiKey }),
    model: aiSettings.preferredModel || "gemini-2.5-flash",
    settings: aiSettings,
  };
}

async function classifyIntent(input: AssistantTurnInput): Promise<Intent> {
  const { ai, model, settings } = await getGemini();
  const today = new Date().toISOString().slice(0, 10);
  const history = (input.history ?? [])
    .slice(-8)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");

  const response = await ai.models.generateContent({
    model,
    contents: [
      "Classify this Flowbase assistant request into one JSON object. Return strict JSON only.",
      `Today is ${today}. Resolve relative dates like tomorrow into YYYY-MM-DD.`,
      `Assistant behavior: ${settings.defaultBehavior}. Tone: ${settings.responseTone}.`,
      "Supported intent types: chat, create_kanban_board, add_kanban_column, add_kanban_task, create_calendar_task, create_note, summarize_note, refine_note, create_whiteboard_prompt, generate_template_app, update_ai_settings.",
      "For unclear create/action requests, choose the closest action type but omit missing required fields so the app can ask a follow-up.",
      "For settings updates, never execute directly. Return update_ai_settings with updates and confirmationText.",
      "Use scheduledTime as HH:MM when present. Use dueDate and scheduledDate as YYYY-MM-DD.",
      "If the user asks for meeting reminder/calendar meeting, use create_calendar_task with taskType reminder and category Meeting.",
      "JSON examples:",
      '{"type":"create_calendar_task","title":"Team meeting","taskType":"reminder","scheduledDate":"2026-06-06","scheduledTime":"14:00","category":"Meeting"}',
      '{"type":"create_kanban_board","boardName":"Launch Plan","columns":["Backlog","In Progress","Review","Done"]}',
      '{"type":"create_kanban_board_with_task","boardName":"Coding Project","columns":["Todo","In Progress","Done"],"taskTitle":"Building My SaaS App","columnName":"In Progress"}',
      '{"type":"add_kanban_column","boardName":"Launch Plan","columnName":"Blocked"}',
      '{"type":"add_kanban_task","title":"Draft launch copy","boardName":"Launch","columnName":"Todo","priority":"Medium","dueDate":"2026-06-06"}',
      '{"type":"chat","reply":"Short natural answer."}',
      history ? `Recent conversation:\n${history}` : "Recent conversation: none",
      `User message: ${input.message}`,
    ].join("\n"),
  });

  const text = response.text?.trim();

  if (!text) {
    return { type: "chat", reply: "I could not read that clearly. Could you try again?" };
  }

  try {
    return extractJson(text);
  } catch {
    return { type: "chat", reply: text };
  }
}

async function chatReply(message: string, history: AssistantHistoryMessage[] = []) {
  const { ai, model, settings } = await getGemini();
  const transcript = history
    .slice(-8)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");
  const response = await ai.models.generateContent({
    model,
    contents: [
      "You are Flowbase AI Assistant, a cozy productivity command center.",
      "Answer naturally and concisely. If a user asks to perform an app action, ask for missing details instead of pretending it is done.",
      `Tone: ${settings.responseTone}. Behavior: ${settings.defaultBehavior}.`,
      transcript ? `Recent conversation:\n${transcript}` : "",
      `User: ${message}`,
    ].join("\n"),
  });

  return response.text?.trim() || "I am here. What would you like to plan, write, or organize?";
}

async function summarizeText(text: string) {
  const { ai, model } = await getGemini();
  const response = await ai.models.generateContent({
    model,
    contents: [
      "Summarize this productivity note in a clear, compact way.",
      "Return a short paragraph followed by 3 concise action bullets if useful.",
      text,
    ].join("\n"),
  });

  return response.text?.trim() || "I could not summarize that note.";
}

function findByName<T extends { name?: string; title?: string }>(items: T[], query?: string) {
  const normalized = query?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return (
    items.find((item) => (item.name ?? item.title ?? "").toLowerCase() === normalized) ??
    items.find((item) => (item.name ?? item.title ?? "").toLowerCase().includes(normalized)) ??
    null
  );
}

async function executePendingAction(action: AssistantPendingAction): Promise<AssistantTurnResult> {
  if (action.type === "update_ai_settings") {
    const data = await getSettingsPageData();
    const nextSettings = {
      ...data.settings,
      aiSettings: {
        ...data.settings.aiSettings,
        ...action.updates,
        features: {
          ...data.settings.aiSettings.features,
          ...(action.updates.features ?? {}),
        },
      },
    };

    await updateUserSettings(nextSettings);

    return {
      message: "Done. I updated your AI settings.",
      actionSummary: action.label,
    };
  }

  return { message: "I could not confirm that action." };
}

async function executeIntent(intent: Intent, input: AssistantTurnInput): Promise<AssistantTurnResult> {
  switch (intent.type) {
    case "create_kanban_board": {
      const boardName = cleanText(intent.boardName);
      if (!boardName) {
        return { message: "What should I call the Kanban board?" };
      }

      const splitIntent = splitBoardNameTaskInstruction(boardName);
      if (splitIntent) {
        return executeIntent(splitIntent, input);
      }

      const requestedColumns = Array.isArray(intent.columns)
        ? intent.columns.map((column) => cleanText(column)).filter(Boolean).slice(0, 5)
        : [];
      const result = await createAssistantKanbanBoard({
        name: boardName,
        color: normalizeColor(intent.color, "#f4b333"),
        columns: requestedColumns,
      });

      return {
        message: result.columns.length
          ? `${result.created ? "Created" : "Found"} the "${result.board.name}" Kanban board with columns: ${result.columns.join(", ")}.`
          : result.created
            ? `Created the "${result.board.name}" Kanban board with Todo, In Progress, and Done columns.`
            : `The "${result.board.name}" Kanban board already exists.`,
        actionSummary: "Kanban board created",
      };
    }

    case "create_kanban_board_with_task": {
      const boardName = cleanText(intent.boardName);
      const taskTitle = cleanText(intent.taskTitle);

      if (!boardName) {
        return { message: "What should I call the Kanban board?" };
      }

      if (!taskTitle) {
        return { message: "What task should I add to the board?" };
      }

      const requestedColumns = Array.isArray(intent.columns)
        ? intent.columns.map((column) => cleanText(column)).filter(Boolean).slice(0, 5)
        : normalizeColumnNames(["Todo", cleanText(intent.columnName, "In Progress"), "Done"]);
      const result = await createAssistantKanbanBoard({
        name: boardName,
        color: normalizeColor(intent.color, "#f4b333"),
        columns: requestedColumns,
      });
      const freshBoards = await getOwnedAssistantKanbanBoards(await getCurrentWorkspaceUserId());
      const board = findByName(freshBoards, result.board.name) ?? result.board;
      const targetColumn =
        findByName(board.columns, intent.columnName) ??
        board.columns.find((column) => column.name.toLowerCase() === "in progress") ??
        board.columns[0];

      if (!targetColumn) {
        return {
          message: `Created the "${result.board.name}" board, but I could not find a column for the task.`,
          actionSummary: "Kanban board created",
        };
      }

      const task = await createAssistantKanbanTask({
        columnId: targetColumn.id,
        title: taskTitle,
        description: cleanText(intent.taskDescription) || undefined,
        dueDate: normalizeDate(intent.dueDate) || undefined,
        priority: allowedPriorities.has(intent.priority as KanbanPriority) ? (intent.priority as KanbanPriority) : "Medium",
      });

      return {
        message: `Created the "${result.board.name}" board and added "${task.title}" to ${targetColumn.name}.`,
        actionSummary: "Kanban board and task created",
      };
    }

    case "add_kanban_column": {
      const columnName = cleanText(intent.columnName);
      if (!columnName) {
        return { message: "What should the new Kanban column be called?" };
      }

      return addAssistantKanbanColumn({ boardName: intent.boardName, columnName });
    }

    case "add_kanban_task": {
      const title = cleanText(intent.title);
      if (!title) {
        return { message: "What should the Kanban task be called?" };
      }

      const boards = await listKanbanBoards();
      if (!boards.length) {
        return { message: "You do not have a Kanban board yet. Tell me a board name and I can create one first." };
      }

      const board = findByName(boards, intent.boardName) ?? (boards.length === 1 ? boards[0] : null);
      if (!board) {
        return { message: `Which board should I add it to? I found: ${boards.map((item) => item.name).join(", ")}.` };
      }

      const column =
        findByName(board.columns, intent.columnName) ??
        board.columns.find((item) => item.name.toLowerCase() === "todo") ??
        board.columns[0];

      if (!column) {
        return { message: `The "${board.name}" board does not have a column yet. Add a column first, then I can place the task.` };
      }

      const task = await createKanbanTask(column.id, {
        title,
        description: cleanText(intent.description) || undefined,
        dueDate: normalizeDate(intent.dueDate) || undefined,
        priority: allowedPriorities.has(intent.priority as KanbanPriority) ? (intent.priority as KanbanPriority) : "Medium",
        labels: intent.labels,
        syncCalendar: Boolean(intent.syncCalendar),
      });

      return {
        message: `Added "${task.title}" to ${board.name} in ${column.name}.`,
        actionSummary: "Kanban task added",
      };
    }

    case "create_calendar_task": {
      const title = cleanText(intent.title);
      if (!title) {
        return { message: "What should I call the calendar item?" };
      }

      const scheduledDate = normalizeDate(intent.scheduledDate);
      if (!scheduledDate) {
        return { message: "What date should I put that on the calendar?" };
      }

      if (/meeting/i.test(title) && !normalizeTime(intent.scheduledTime)) {
        return { message: "What time is the meeting?" };
      }

      const categories = await listUserCategories(intent.taskType === "reminder" ? "reminders" : "calendar");
      const category =
        findByName(categories, intent.category) ??
        findByName(categories, /meeting/i.test(title) ? "Meeting" : undefined) ??
        categories[0];
      const task = await createCalendarTask({
        title,
        description: cleanText(intent.description) || undefined,
        type: intent.taskType === "reminder" ? "reminder" : "task",
        category: category?.name ?? cleanText(intent.category, "General"),
        categoryColor: category?.color ?? "#ef594a",
        scheduledDate,
        scheduledTime: normalizeTime(intent.scheduledTime) || null,
      });

      return {
        message: `Added "${task.title}" to your calendar for ${task.scheduledDate}${task.scheduledTime ? ` at ${task.scheduledTime}` : ""}.`,
        actionSummary: "Calendar item created",
      };
    }

    case "create_note": {
      const note = await createNote({ title: cleanText(intent.title, "Untitled note"), color: "#55cdb4" });
      const content = cleanText(intent.content);
      const finalNote = content ? await updateNote(note.id, { content: tiptapDocFromText(content) }) : note;
      return {
        message: `Created the note "${finalNote.title}".`,
        actionSummary: "Note created",
      };
    }

    case "summarize_note": {
      const directContent = cleanText(intent.content);
      if (directContent) {
        return { message: await summarizeText(directContent) };
      }

      const notes = await listNotes();
      const note = findByName(notes, intent.noteTitle);

      if (!note) {
        return { message: "Which note should I summarize? Give me the note title or paste the note text." };
      }

      const noteText = textFromNoteContent(note.content);
      if (!noteText) {
        return { message: `"${note.title}" does not have enough text to summarize yet.` };
      }

      return {
        message: await summarizeText(noteText),
        actionSummary: `Summarized "${note.title}"`,
      };
    }

    case "refine_note": {
      const text = cleanText(intent.text);
      if (!text) {
        return { message: "Paste the note text you want me to refine." };
      }

      const operation = allowedRefineOperations.has(intent.operation as RefineOperation)
        ? (intent.operation as RefineOperation)
        : "Rephrase";
      const refined = await refineSelectedText({ text, operation, tone: intent.tone });
      return {
        message: refined,
        actionSummary: "Refined note text",
      };
    }

    case "create_whiteboard_prompt": {
      const prompt = cleanText(intent.prompt) || cleanText(input.message);
      if (!prompt) {
        return { message: "What should the whiteboard diagram be about?" };
      }

      const diagram = await generateWhiteboardDiagram(prompt);
      await createWhiteboard({ name: cleanText(intent.name, diagram.title), color: "#ef594a" });

      return {
        message: `Created a whiteboard called "${diagram.title}" and generated a ${diagram.type.replace(/_/g, " ")} plan with ${diagram.nodes.length} nodes. Open Whiteboard to turn it into a visual diagram.`,
        actionSummary: "Whiteboard created",
      };
    }

    case "generate_template_app": {
      const prompt = cleanText(intent.prompt) || cleanText(input.message);
      if (!prompt) {
        return { message: "What kind of mini app should I generate?" };
      }

      const app = await generateTemplateApp(prompt);
      return {
        message: `Generated "${app.appName}" in AI Template Builder.`,
        actionSummary: "Template app generated",
      };
    }

    case "update_ai_settings": {
      if (!intent.updates || !Object.keys(intent.updates).length) {
        return { message: "Which AI setting should I update?" };
      }

      return {
        message: intent.confirmationText || "Please confirm before I update your AI settings.",
        pendingAction: {
          type: "update_ai_settings",
          label: intent.confirmationText || "Update AI settings",
          updates: intent.updates,
        },
      };
    }

    case "chat":
    default:
      return { message: cleanText(intent.reply) || (await chatReply(input.message, input.history)) };
  }
}

export async function runAssistantTurn(input: AssistantTurnInput): Promise<AssistantTurnResult> {
  if (input.confirmedAction) {
    return executePendingAction(input.confirmedAction);
  }

  const message = input.message.trim();
  if (!message) {
    return { message: "Send me a prompt and I will help route it." };
  }

  try {
    const intent = parseKanbanShortcut(message, input.history) ?? (await classifyIntent(input));
    return await executeIntent(intent, input);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "I hit a snag while handling that request.",
    };
  }
}
