"use server";

import { GoogleGenAI } from "@google/genai";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { notes, users } from "@/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { getUserAISettings } from "@/lib/user-settings";

export type NoteContent = Record<string, unknown>;

export type NoteDTO = {
  id: number;
  title: string;
  content: NoteContent;
  color: string;
  icon: string;
  isPinned: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RefineOperation =
  | "Improve grammar"
  | "Rephrase"
  | "Make shorter"
  | "Make longer"
  | "Simplify language"
  | "Change tone";

export type RefineTone = "friendly" | "professional" | "confident" | "casual";

const defaultNoteContent: NoteContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const noteColors = new Set(["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259"]);
const noteIcons = new Set(["FileText", "BookOpen", "Lightbulb", "Sparkles", "PenLine", "NotebookPen"]);

function serializeNote(note: typeof notes.$inferSelect): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    color: note.color,
    icon: note.icon,
    isPinned: note.isPinned,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function normalizeTitle(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 140) : "Untitled note";
}

function normalizeColor(value?: string) {
  return value && noteColors.has(value) ? value : "#55cdb4";
}

function normalizeContent(value?: NoteContent) {
  return value && value.type === "doc" ? value : defaultNoteContent;
}

async function getCurrentUserId() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage notes.");
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

async function requireNote(userId: number, noteId: number) {
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .limit(1);

  if (!note) {
    throw new Error("Note not found.");
  }

  return note;
}

export async function listNotes() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt));

  return rows.map(serializeNote);
}

export async function createNote(input?: { title?: string; color?: string }) {
  const userId = await getCurrentUserId();
  const [note] = await db
    .insert(notes)
    .values({
      userId,
      title: normalizeTitle(input?.title),
      content: defaultNoteContent,
      color: normalizeColor(input?.color),
      icon: "FileText",
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/notes");
  return serializeNote(note);
}

export async function updateNote(
  noteId: number,
  input: Partial<{ title: string; content: NoteContent; color: string; icon: string; isPinned: boolean }>
) {
  const userId = await getCurrentUserId();
  await requireNote(userId, noteId);

  const payload: Partial<typeof notes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof input.title === "string") {
    payload.title = normalizeTitle(input.title);
  }

  if (input.content) {
    payload.content = normalizeContent(input.content);
  }

  if (typeof input.color === "string") {
    payload.color = normalizeColor(input.color);
  }

  if (typeof input.icon === "string") {
    payload.icon = noteIcons.has(input.icon) ? input.icon : "FileText";
  }

  if (typeof input.isPinned === "boolean") {
    payload.isPinned = input.isPinned;
  }

  const [note] = await db
    .update(notes)
    .set(payload)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .returning();

  revalidatePath("/notes");
  return serializeNote(note);
}

export async function duplicateNote(noteId: number) {
  const userId = await getCurrentUserId();
  const note = await requireNote(userId, noteId);
  const [copy] = await db
    .insert(notes)
    .values({
      userId,
      title: `${note.title} copy`,
      content: note.content,
      color: note.color,
      icon: note.icon,
      isPinned: false,
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/notes");
  return serializeNote(copy);
}

export async function deleteNote(noteId: number) {
  const userId = await getCurrentUserId();
  const [note] = await db
    .update(notes)
    .set({ deletedAt: new Date(), isPinned: false, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
    .returning();

  if (!note) {
    throw new Error("Note not found.");
  }

  revalidatePath("/notes");
  return serializeNote(note);
}

export async function restoreNote(noteId: number) {
  const userId = await getCurrentUserId();
  const [note] = await db
    .update(notes)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNotNull(notes.deletedAt)))
    .returning();

  if (!note) {
    throw new Error("Note not found.");
  }

  revalidatePath("/notes");
  return serializeNote(note);
}

export async function permanentlyDeleteNote(noteId: number) {
  const userId = await getCurrentUserId();
  await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNotNull(notes.deletedAt)));
  revalidatePath("/notes");
}

export async function refineSelectedText(input: {
  text: string;
  operation: RefineOperation;
  tone?: RefineTone;
}) {
  const text = input.text.trim();

  if (!text) {
    throw new Error("Select text before using AI Refine.");
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const userId = await getCurrentUserId();
  const aiSettings = await getUserAISettings(userId);

  if (!aiSettings.features.aiRefine) {
    throw new Error("AI Refine is disabled in Settings.");
  }

  const toneInstruction =
    input.operation === "Change tone" ? ` Use a ${input.tone ?? aiSettings.responseTone ?? "friendly"} tone.` : "";
  const prompt = [
    "Rewrite the selected note text according to the requested operation.",
    "Return only the replacement text. Do not wrap it in quotes or markdown fences.",
    `Operation: ${input.operation}.${toneInstruction}`,
    "Selected text:",
    text,
  ].join("\n");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: aiSettings.preferredModel || "gemini-2.5-flash",
    contents: prompt,
  });
  const refined = response.text?.trim();

  if (!refined) {
    throw new Error("Gemini did not return refined text.");
  }

  return refined;
}

export async function countActiveNotes() {
  const userId = await getCurrentUserId();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.deletedAt)));

  return row?.count ?? 0;
}
