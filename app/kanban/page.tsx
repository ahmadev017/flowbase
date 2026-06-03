import { AppShell } from "@/components/app-shell";
import { KanbanPage } from "@/components/kanban-page";

import { KanbanBoardDTO, listKanbanBoards } from "./actions";

export default async function KanbanRoute() {
  let boards: KanbanBoardDTO[] = [];
  let authError: string | undefined;

  try {
    boards = await listKanbanBoards();
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load Kanban boards.";
  }

  return (
    <AppShell>
      <KanbanPage initialBoards={boards} authError={authError} />
    </AppShell>
  );
}
