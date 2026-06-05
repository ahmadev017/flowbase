"use server";

import { GoogleGenAI } from "@google/genai";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { GeneratedAppSchema, generatedApps, users } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { syncCurrentUser } from "@/lib/sync-user";
import { getUserAISettings } from "@/lib/user-settings";

export type GeneratedAppComponent = GeneratedAppSchema["sections"][number]["components"][number];
export type GeneratedAppDTO = {
  id: number;
  appName: string;
  description: string;
  icon: string;
  color: string;
  layout: "single-page";
  schema: GeneratedAppSchema;
  isSidebarPinned: boolean;
  sidebarPosition: number | null;
  createdAt: string;
  updatedAt: string;
};

const allowedIcons = new Set([
  "BadgeDollarSign",
  "BarChart3",
  "BookOpen",
  "Brain",
  "Calculator",
  "CalendarDays",
  "CheckCircle2",
  "ClipboardList",
  "Clock",
  "Dumbbell",
  "Flame",
  "HeartPulse",
  "LayoutTemplate",
  "ListChecks",
  "NotebookPen",
  "PiggyBank",
  "Sparkles",
  "Target",
  "Utensils",
  "WalletCards",
]);
const componentTypes = new Set(["stats", "list", "table", "form", "progress", "checklist", "buttons", "tags", "chart", "calculator"]);
const actionVariants = new Set(["primary", "secondary"]);
const maxSidebarApps = 3;

function serializeApp(app: typeof generatedApps.$inferSelect): GeneratedAppDTO {
  return {
    id: app.id,
    appName: app.appName,
    description: app.description,
    icon: app.icon,
    color: app.color,
    layout: "single-page",
    schema: app.schema,
    isSidebarPinned: app.isSidebarPinned,
    sidebarPosition: app.sidebarPosition,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function normalizeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ef594a";
}

function normalizeIcon(value: unknown) {
  const icon = cleanText(value, "LayoutTemplate", 40);
  return allowedIcons.has(icon) ? icon : "LayoutTemplate";
}

function normalizeAction(value: unknown, index: number): GeneratedAppSchema["actions"][number] {
  const input = value as Record<string, unknown>;
  const variant = cleanText(input?.variant, index === 0 ? "primary" : "secondary", 20);

  return {
    label: cleanText(input?.label, index === 0 ? "Add item" : "View details", 40),
    variant: actionVariants.has(variant) ? (variant as "primary" | "secondary") : "secondary",
  };
}

function normalizeFields(value: unknown): GeneratedAppComponent["fields"] {
  return Array.isArray(value)
    ? value.slice(0, 8).map((field, index) => {
        const input = field as Record<string, unknown>;
        return {
          label: cleanText(input?.label, `Field ${index + 1}`, 40),
          type: cleanText(input?.type, "text", 20),
          placeholder: cleanText(input?.placeholder, "", 70),
          value: cleanText(input?.value, "", 70),
        };
      })
    : [];
}

function normalizeItems(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 8).map((item, index) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .slice(0, 8)
          .map(([key, entry]) => [cleanText(key, `field${index + 1}`, 32), entry])
      );
    }

    return { label: String(item ?? `Item ${index + 1}`) };
  });
}

function normalizeComponent(value: unknown, index: number): GeneratedAppComponent {
  const input = value as Record<string, unknown>;
  const type = cleanText(input?.type, index % 3 === 0 ? "stats" : index % 3 === 1 ? "list" : "progress", 20);

  return {
    id: cleanText(input?.id, `component-${index + 1}`, 40).replace(/\s+/g, "-").toLowerCase(),
    type: componentTypes.has(type) ? (type as GeneratedAppComponent["type"]) : "list",
    title: cleanText(input?.title, `Block ${index + 1}`, 70),
    description: cleanText(input?.description, "", 120),
    fields: normalizeFields(input?.fields),
    items: normalizeItems(input?.items),
    actions: Array.isArray(input?.actions) ? input.actions.slice(0, 4).map(normalizeAction) : [],
  };
}

function normalizeSchema(value: unknown): GeneratedAppSchema {
  const input = value as Record<string, unknown>;
  const appName = cleanText(input?.appName, "Generated App", 80);
  const description = cleanText(input?.description, "A focused single-page workspace generated from your prompt.", 180);
  const color = normalizeColor(input?.color);
  const icon = normalizeIcon(input?.icon);
  const rawSections = Array.isArray(input?.sections) ? input.sections : [];
  const sections = rawSections.slice(0, 5).map((section, sectionIndex) => {
    const sectionInput = section as Record<string, unknown>;
    const components = Array.isArray(sectionInput?.components)
      ? sectionInput.components.slice(0, 6).map(normalizeComponent)
      : [];

    return {
      id: cleanText(sectionInput?.id, `section-${sectionIndex + 1}`, 40).replace(/\s+/g, "-").toLowerCase(),
      title: cleanText(sectionInput?.title, sectionIndex === 0 ? "Overview" : `Section ${sectionIndex + 1}`, 70),
      description: cleanText(sectionInput?.description, "", 140),
      components,
    };
  });

  if (!sections.length) {
    sections.push({
      id: "overview",
      title: "Overview",
      description,
      components: [
        {
          id: "stats",
          type: "stats",
          title: "Quick stats",
          items: [
            { label: "Items", value: "12" },
            { label: "Progress", value: "68%" },
            { label: "Today", value: "4" },
          ],
          fields: [],
          actions: [],
        },
        {
          id: "checklist",
          type: "checklist",
          title: "Starter checklist",
          items: [
            { label: "Create first entry", checked: true },
            { label: "Review progress", checked: false },
            { label: "Plan next step", checked: false },
          ],
          fields: [],
          actions: [],
        },
      ],
    });
  }

  return {
    appName,
    description,
    icon,
    color,
    layout: "single-page",
    sections,
    actions: Array.isArray(input?.actions) ? input.actions.slice(0, 4).map(normalizeAction) : [],
    sampleData: normalizeItems(input?.sampleData),
  };
}

function isCalculatorPrompt(prompt: string) {
  return /\b(calc|calculator|calculate|calculation|math|arithmetic)\b/i.test(prompt);
}

function buildCalculatorSchema(prompt: string): GeneratedAppSchema {
  return {
    appName: "Calculator",
    description: "A simple calculator for quick arithmetic.",
    icon: "Calculator",
    color: "#2d9cdb",
    layout: "single-page",
    sections: [
      {
        id: "calculator",
        title: "Calculator",
        description: prompt.toLowerCase().includes("scientific")
          ? "Use the keypad for arithmetic and quick percentage calculations."
          : "Use the keypad for everyday arithmetic.",
        components: [
          {
            id: "calculator",
            type: "calculator",
            title: "Calculator",
            description: "Add, subtract, multiply, divide, clear, delete, and calculate results.",
            fields: [],
            items: [],
            actions: [],
          },
          {
            id: "history",
            type: "list",
            title: "Recent calculations",
            description: "Completed calculations appear here.",
            fields: [],
            items: [],
            actions: [],
          },
        ],
      },
    ],
    actions: [],
    sampleData: [],
  };
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return app JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

async function getCurrentUserId() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage AI templates.");
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

async function requireGeneratedApp(userId: number, appId: number) {
  const [app] = await db
    .select()
    .from(generatedApps)
    .where(and(eq(generatedApps.id, appId), eq(generatedApps.userId, userId)))
    .limit(1);

  if (!app) {
    throw new Error("Generated app not found.");
  }

  return app;
}

export async function listGeneratedApps() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select()
    .from(generatedApps)
    .where(eq(generatedApps.userId, userId))
    .orderBy(desc(generatedApps.createdAt));

  return rows.map(serializeApp);
}

export async function listSidebarGeneratedApps() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select()
    .from(generatedApps)
    .where(and(eq(generatedApps.userId, userId), eq(generatedApps.isSidebarPinned, true)))
    .orderBy(asc(generatedApps.sidebarPosition), asc(generatedApps.createdAt));

  return rows.map(serializeApp);
}

export async function getGeneratedApp(appId: number) {
  const userId = await getCurrentUserId();
  return serializeApp(await requireGeneratedApp(userId, appId));
}

export async function generateTemplateApp(prompt: string) {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error("Enter an app idea prompt first.");
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const userId = await getCurrentUserId();
  const aiSettings = await getUserAISettings(userId);

  if (!aiSettings.features.aiTemplateBuilder) {
    throw new Error("AI Template Builder is disabled in Settings.");
  }

  const calculatorSchema = isCalculatorPrompt(cleanPrompt) ? buildCalculatorSchema(cleanPrompt) : null;

  if (calculatorSchema) {
    const [app] = await db
      .insert(generatedApps)
      .values({
        userId,
        appName: calculatorSchema.appName,
        description: calculatorSchema.description,
        icon: calculatorSchema.icon,
        color: calculatorSchema.color,
        layout: calculatorSchema.layout,
        schema: calculatorSchema,
        updatedAt: new Date(),
      })
      .returning();

    revalidatePath("/ai-template-builder");
    await logActivity({
      userId,
      feature: "ai-template-builder",
      action: "Generated AI template",
      title: app.appName,
      metadata: { appId: app.id },
    });
    return serializeApp(app);
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: aiSettings.preferredModel || "gemini-2.5-flash",
    contents: [
      "Create a concise single-page mini app/template model for a productivity dashboard.",
      `Default behavior: ${aiSettings.defaultBehavior}. Tone: ${aiSettings.responseTone}.`,
      "Return only strict JSON. No markdown, comments, or prose.",
      "Required shape:",
      '{"appName":"string","description":"string","icon":"Lucide icon name","color":"#RRGGBB","layout":"single-page","sections":[{"id":"short-id","title":"string","description":"optional","components":[{"id":"short-id","type":"stats|list|table|form|progress|checklist|buttons|tags|chart|calculator","title":"string","description":"optional","fields":[{"label":"string","type":"text|number|date|select|textarea","placeholder":"string","value":"string"}],"items":[{"label":"string","value":"string","status":"string","progress":number,"checked":boolean}],"actions":[{"label":"string","variant":"primary|secondary"}]}]}],"actions":[{"label":"string","variant":"primary|secondary"}],"sampleData":[{"label":"string","value":"string"}]}',
      "If the user asks for a calculator, the first component must be type calculator and the app should be named Calculator.",
      "Use 2 to 4 sections. Include a useful mix of stats, table/list/checklist/form/progress/tags/chart blocks for non-calculator apps.",
      "Keep all text short enough for responsive UI cards. Use a valid hex theme color.",
      "Choose an icon from: Flame, Calculator, CalendarDays, PiggyBank, Utensils, BookOpen, ListChecks, Target, WalletCards, HeartPulse, Brain, Clock, ClipboardList, Sparkles.",
      `User prompt: ${cleanPrompt}`,
    ].join("\n"),
  });
  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini did not return a template app.");
  }

  const schema = normalizeSchema(extractJson(text));
  const [app] = await db
    .insert(generatedApps)
    .values({
      userId,
      appName: schema.appName,
      description: schema.description,
      icon: schema.icon,
      color: schema.color,
      layout: schema.layout,
      schema,
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/ai-template-builder");
  await logActivity({
    userId,
    feature: "ai-template-builder",
    action: "Generated AI template",
    title: app.appName,
    metadata: { appId: app.id },
  });
  return serializeApp(app);
}

export async function deleteGeneratedApp(appId: number) {
  const userId = await getCurrentUserId();
  await requireGeneratedApp(userId, appId);
  await db.delete(generatedApps).where(and(eq(generatedApps.id, appId), eq(generatedApps.userId, userId)));
  revalidatePath("/ai-template-builder");
  revalidatePath("/");
}

export async function updateGeneratedAppSchema(appId: number, schemaInput: GeneratedAppSchema) {
  const userId = await getCurrentUserId();
  await requireGeneratedApp(userId, appId);
  const schema = normalizeSchema(schemaInput);
  const [updated] = await db
    .update(generatedApps)
    .set({
      appName: schema.appName,
      description: schema.description,
      icon: schema.icon,
      color: schema.color,
      layout: schema.layout,
      schema,
      updatedAt: new Date(),
    })
    .where(and(eq(generatedApps.id, appId), eq(generatedApps.userId, userId)))
    .returning();

  revalidatePath("/ai-template-builder");
  revalidatePath(`/ai-template-builder/${appId}`);
  await logActivity({
    userId,
    feature: "ai-template-builder",
    action: "Updated AI template",
    title: updated.appName,
    metadata: { appId: updated.id },
  });
  return serializeApp(updated);
}

export async function toggleGeneratedAppSidebar(appId: number, pin: boolean) {
  const userId = await getCurrentUserId();
  const app = await requireGeneratedApp(userId, appId);

  if (!pin) {
    const [updated] = await db
      .update(generatedApps)
      .set({ isSidebarPinned: false, sidebarPosition: null, updatedAt: new Date() })
      .where(and(eq(generatedApps.id, app.id), eq(generatedApps.userId, userId)))
      .returning();

    revalidatePath("/ai-template-builder");
    revalidatePath("/");
    return serializeApp(updated);
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generatedApps)
    .where(and(eq(generatedApps.userId, userId), eq(generatedApps.isSidebarPinned, true)));

  if ((countRow?.count ?? 0) >= maxSidebarApps && !app.isSidebarPinned) {
    throw new Error("You can add up to 3 generated apps to the sidebar.");
  }

  const [positionRow] = await db
    .select({ position: sql<number>`coalesce(max(${generatedApps.sidebarPosition}), -1)::int` })
    .from(generatedApps)
    .where(and(eq(generatedApps.userId, userId), eq(generatedApps.isSidebarPinned, true)));

  const [updated] = await db
    .update(generatedApps)
    .set({
      isSidebarPinned: true,
      sidebarPosition: app.sidebarPosition ?? (positionRow?.position ?? -1) + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(generatedApps.id, app.id), eq(generatedApps.userId, userId)))
    .returning();

  revalidatePath("/ai-template-builder");
  revalidatePath("/");
  return serializeApp(updated);
}
