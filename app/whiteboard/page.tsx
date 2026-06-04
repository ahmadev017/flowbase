import { AppShell } from "@/components/app-shell";
import { WhiteboardPage } from "@/components/whiteboard-page";

import { WhiteboardDTO, listWhiteboards } from "./actions";

export default async function WhiteboardRoute() {
  let whiteboards: WhiteboardDTO[] = [];
  let authError: string | undefined;

  try {
    whiteboards = await listWhiteboards();
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load whiteboards.";
  }

  return (
    <AppShell>
      <WhiteboardPage initialWhiteboards={whiteboards} authError={authError} />
    </AppShell>
  );
}
