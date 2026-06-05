import { auth } from "@clerk/nextjs/server";

export const planSlugs = {
  free: "free",
  pro: "pro",
} as const;

export const freePlanLimits = {
  calendarItems: 25,
  kanbanBoards: 3,
  notes: 30,
  whiteboards: 3,
  generatedApps: 5,
  aiGenerationsPerMonth: 20,
} as const;

export type UserEntitlements = {
  plan: "free" | "pro";
  isPro: boolean;
  limits: typeof freePlanLimits;
};

type AuthWithPlanCheck = Awaited<ReturnType<typeof auth>> & {
  has?: (params: { plan?: string; feature?: string }) => boolean;
};

export async function getUserEntitlements(): Promise<UserEntitlements> {
  const session = (await auth()) as AuthWithPlanCheck;
  const hasProPlan = typeof session.has === "function" ? session.has({ plan: planSlugs.pro }) : false;

  return {
    plan: hasProPlan ? planSlugs.pro : planSlugs.free,
    isPro: hasProPlan,
    limits: freePlanLimits,
  };
}
