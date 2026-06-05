import { AppShell } from "@/components/app-shell";
import { KanbanPage } from "@/components/kanban-page";

import { KanbanBoardDTO, listKanbanBoards } from "./actions";
import { listUserCategories, type UserCategoryDTO } from "@/app/settings/actions";

export default async function KanbanRoute() {
  let boards: KanbanBoardDTO[] = [];
  let categories: UserCategoryDTO[] = [];
  let authError: string | undefined;

  try {
    [boards, categories] = await Promise.all([listKanbanBoards(), listUserCategories("kanban")]);
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load Kanban boards.";
  }

  return (
    <AppShell>
      <KanbanPage initialBoards={boards} initialCategories={categories} authError={authError} />
    </AppShell>
  );
}
