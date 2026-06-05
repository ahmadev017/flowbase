import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import { db } from "@/db";
import { userSettings, users, type UserAISettings } from "@/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";

export const defaultAISettings: UserAISettings = {
  preferredModel: "gemini-2.5-flash",
  defaultBehavior: "balanced",
  responseTone: "friendly",
  features: {
    aiRefine: true,
    aiAssistant: true,
    aiTemplateBuilder: true,
    aiWhiteboard: true,
  },
};

export async function getCurrentWorkspaceUserId() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage your workspace.");
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

export async function getUserAISettings(userId?: number) {
  const resolvedUserId = userId ?? (await getCurrentWorkspaceUserId());
  const [settings] = await db
    .select({ aiSettings: userSettings.aiSettings })
    .from(userSettings)
    .where(eq(userSettings.userId, resolvedUserId))
    .limit(1);

  return settings?.aiSettings ?? defaultAISettings;
}
