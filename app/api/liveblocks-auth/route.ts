import { currentUser } from "@clerk/nextjs/server";

import { getAvatarColor, getLiveblocksClient, normalizeEmail } from "@/lib/liveblocks";

export async function POST() {
  const liveblocks = getLiveblocksClient();

  if (!liveblocks) {
    return new Response("Liveblocks is not configured.", { status: 500 });
  }

  const user = await currentUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const email = normalizeEmail(
    user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses.find((address) => address.emailAddress)?.emailAddress ??
      ""
  );

  if (!email) {
    return new Response("User email is required.", { status: 401 });
  }

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || email;

  const { status, body } = await liveblocks.identifyUser(email, {
    userInfo: {
      name,
      email,
      avatar: user.imageUrl,
      color: getAvatarColor(email),
    },
  });

  return new Response(body, { status });
}
