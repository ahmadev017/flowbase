import { currentUser } from "@clerk/nextjs/server";

const TOKEN_URL = "https://agents.assemblyai.com/v1/token";

export async function GET() {
  let user: Awaited<ReturnType<typeof currentUser>>;

  try {
    user = await currentUser();
  } catch {
    return Response.json({ error: "Unable to verify the signed-in user." }, { status: 401 });
  }

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "ASSEMBLYAI_API_KEY is not configured." }, { status: 500 });
  }

  const url = new URL(TOKEN_URL);
  url.searchParams.set("expires_in_seconds", "120");
  url.searchParams.set("max_session_duration_seconds", "3600");

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return Response.json({ error: "Unable to create AssemblyAI voice agent token." }, { status: 500 });
    }

    const data = (await response.json()) as {
      token?: string;
      expires_in_seconds?: number;
    };

    if (!data.token) {
      return Response.json({ error: "AssemblyAI did not return a voice agent token." }, { status: 500 });
    }

    return Response.json({
      token: data.token,
      expiresInSeconds: data.expires_in_seconds ?? 120,
    });
  } catch {
    return Response.json({ error: "Unable to reach AssemblyAI voice agent token service." }, { status: 500 });
  }
}
