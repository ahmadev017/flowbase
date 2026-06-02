import { currentUser } from "@clerk/nextjs/server";

function getDisplayName(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return fullName || user.username || user.primaryEmailAddress?.emailAddress || null;
}

export async function syncCurrentUser() {
  try {
    const user = await currentUser();

    if (!user) {
      return null;
    }

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses.find((address) => address.emailAddress)?.emailAddress;

    if (!email) {
      return null;
    }

    const syncedUser = {
      clerkId: user.id,
      email,
      name: getDisplayName(user),
      imageUrl: user.imageUrl,
      updatedAt: new Date(),
    };

    const [{ db }, { users }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
    ]);

    await db
      .insert(users)
      .values(syncedUser)
      .onConflictDoUpdate({
        target: users.clerkId,
        set: syncedUser,
      });

    return syncedUser;
  } catch (error) {
    console.error("Failed to sync Clerk user to database", error);
    return null;
  }
}
