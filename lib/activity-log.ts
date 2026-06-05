import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { activityLogs, type ActivityMetadata } from "@/db/schema";

export type ActivityFeature =
  | "calendar"
  | "kanban"
  | "notes"
  | "whiteboard"
  | "assistant"
  | "ai-template-builder"
  | "spaces";

export async function logActivity(input: {
  userId: number;
  feature: ActivityFeature;
  action: string;
  title: string;
  metadata?: ActivityMetadata;
}) {
  try {
    await db.insert(activityLogs).values({
      userId: input.userId,
      feature: input.feature,
      action: input.action,
      title: input.title.trim().slice(0, 180) || "Workspace activity",
      metadata: input.metadata ?? {},
      updatedAt: new Date(),
    });
    revalidatePath("/");
  } catch {
    // Activity should enrich the dashboard, not block the user's primary action.
  }
}
