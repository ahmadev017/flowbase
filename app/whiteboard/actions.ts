"use server";

import { GoogleGenAI } from "@google/genai";
import { currentUser } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { users, whiteboards } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { syncCurrentUser } from "@/lib/sync-user";
import { getUserAISettings } from "@/lib/user-settings";

export type WhiteboardSceneElements = unknown[];
export type WhiteboardAppState = Record<string, unknown>;
export type WhiteboardFiles = Record<string, unknown>;

export type WhiteboardDTO = {
  id: number;
  name: string;
  color: string;
  sceneElements: WhiteboardSceneElements;
  appState: WhiteboardAppState;
  files: WhiteboardFiles;
  createdAt: string;
  updatedAt: string;
};

export type DiagramNode = {
  id: string;
  label: string;
  detail?: string;
  group?: string;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type GeneratedDiagram = {
  type: "flowchart" | "mind_map" | "system_architecture" | "user_journey" | "process";
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

const boardColors = new Set(["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259"]);
const diagramTypes = new Set(["flowchart", "mind_map", "system_architecture", "user_journey", "process"]);

function serializeWhiteboard(board: typeof whiteboards.$inferSelect): WhiteboardDTO {
  return {
    id: board.id,
    name: board.name,
    color: board.color,
    sceneElements: Array.isArray(board.sceneElements) ? board.sceneElements : [],
    appState: board.appState && typeof board.appState === "object" ? board.appState : {},
    files: board.files && typeof board.files === "object" ? board.files : {},
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

function normalizeName(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : "Untitled whiteboard";
}

function normalizeColor(value?: string) {
  return value && boardColors.has(value) ? value : "#ef594a";
}

function normalizeElements(value?: WhiteboardSceneElements) {
  return Array.isArray(value) ? value : [];
}

function normalizeRecord(value?: WhiteboardAppState | WhiteboardFiles) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function getCurrentUserId() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage whiteboards.");
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

async function requireWhiteboard(userId: number, whiteboardId: number) {
  const [board] = await db
    .select()
    .from(whiteboards)
    .where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error("Whiteboard not found.");
  }

  return board;
}

export async function listWhiteboards() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select()
    .from(whiteboards)
    .where(eq(whiteboards.userId, userId))
    .orderBy(desc(whiteboards.updatedAt));

  return rows.map(serializeWhiteboard);
}

export async function createWhiteboard(input?: { name?: string; color?: string }) {
  const userId = await getCurrentUserId();
  const [board] = await db
    .insert(whiteboards)
    .values({
      userId,
      name: normalizeName(input?.name),
      color: normalizeColor(input?.color),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/whiteboard");
  await logActivity({
    userId,
    feature: "whiteboard",
    action: "Created whiteboard",
    title: board.name,
    metadata: { whiteboardId: board.id },
  });
  return serializeWhiteboard(board);
}

export async function updateWhiteboard(
  whiteboardId: number,
  input: {
    sceneElements?: WhiteboardSceneElements;
    appState?: WhiteboardAppState;
    files?: WhiteboardFiles;
  }
) {
  const userId = await getCurrentUserId();
  await requireWhiteboard(userId, whiteboardId);

  const [board] = await db
    .update(whiteboards)
    .set({
      sceneElements: normalizeElements(input.sceneElements),
      appState: normalizeRecord(input.appState),
      files: normalizeRecord(input.files),
      updatedAt: new Date(),
    })
    .where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)))
    .returning();

  revalidatePath("/whiteboard");
  await logActivity({
    userId,
    feature: "whiteboard",
    action: "Updated whiteboard",
    title: board.name,
    metadata: { whiteboardId: board.id, elementCount: board.sceneElements.length },
  });
  return serializeWhiteboard(board);
}

export async function renameWhiteboard(whiteboardId: number, input: { name?: string; color?: string }) {
  const userId = await getCurrentUserId();
  await requireWhiteboard(userId, whiteboardId);

  const [board] = await db
    .update(whiteboards)
    .set({
      name: normalizeName(input.name),
      color: normalizeColor(input.color),
      updatedAt: new Date(),
    })
    .where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)))
    .returning();

  revalidatePath("/whiteboard");
  await logActivity({
    userId,
    feature: "whiteboard",
    action: "Renamed whiteboard",
    title: board.name,
    metadata: { whiteboardId: board.id },
  });
  return serializeWhiteboard(board);
}

export async function deleteWhiteboard(whiteboardId: number) {
  const userId = await getCurrentUserId();
  await db.delete(whiteboards).where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)));
  revalidatePath("/whiteboard");
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return diagram JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function normalizeDiagram(value: unknown): GeneratedDiagram {
  const input = value as Partial<GeneratedDiagram>;
  const nodes = Array.isArray(input.nodes)
    ? input.nodes
        .map((node, index) => {
          const item = node as Partial<DiagramNode>;
          const label = typeof item.label === "string" ? item.label.trim() : "";
          if (!label) {
            return null;
          }
          const normalizedNode: DiagramNode = {
            id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `node-${index + 1}`,
            label: label.slice(0, 80),
          };
          if (typeof item.detail === "string" && item.detail.trim()) {
            normalizedNode.detail = item.detail.slice(0, 120);
          }
          if (typeof item.group === "string" && item.group.trim()) {
            normalizedNode.group = item.group.slice(0, 60);
          }
          return normalizedNode;
        })
        .filter((node): node is DiagramNode => Boolean(node))
    : [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(input.edges)
    ? input.edges
        .map((edge) => {
          const item = edge as Partial<DiagramEdge>;
          return {
            from: typeof item.from === "string" ? item.from : "",
            to: typeof item.to === "string" ? item.to : "",
            label: typeof item.label === "string" ? item.label.slice(0, 50) : undefined,
          };
        })
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    : [];

  if (nodes.length < 2) {
    throw new Error("Gemini returned too few diagram nodes.");
  }

  return {
    type: diagramTypes.has(String(input.type)) ? (input.type as GeneratedDiagram["type"]) : "flowchart",
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 90) : "Generated diagram",
    nodes: nodes.slice(0, 12),
    edges: edges.slice(0, 16),
  };
}

export async function generateWhiteboardDiagram(prompt: string) {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error("Enter a diagram prompt first.");
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const userId = await getCurrentUserId();
  const aiSettings = await getUserAISettings(userId);

  if (!aiSettings.features.aiWhiteboard) {
    throw new Error("AI Whiteboard is disabled in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: aiSettings.preferredModel || "gemini-2.5-flash",
    contents: [
      "Create a concise diagram model for an Excalidraw whiteboard.",
      `Default behavior: ${aiSettings.defaultBehavior}. Tone: ${aiSettings.responseTone}.`,
      "Return only strict JSON with this exact shape:",
      '{"type":"flowchart|mind_map|system_architecture|user_journey|process","title":"string","nodes":[{"id":"short-id","label":"string","detail":"optional string","group":"optional string"}],"edges":[{"from":"node-id","to":"node-id","label":"optional string"}]}',
      "Use 3 to 10 nodes. Keep labels short. Ensure every edge references existing node ids.",
      `User prompt: ${cleanPrompt}`,
    ].join("\n"),
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini did not return a diagram.");
  }

  return normalizeDiagram(extractJson(text));
}
