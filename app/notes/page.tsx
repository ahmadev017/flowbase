import { AppShell } from "@/components/app-shell";
import { NotesPage } from "@/components/notes-page";

import { NoteDTO, listNotes } from "./actions";
import { listUserCategories, type UserCategoryDTO } from "@/app/settings/actions";

export default async function NotesRoute() {
  let notes: NoteDTO[] = [];
  let categories: UserCategoryDTO[] = [];
  let authError: string | undefined;

  try {
    [notes, categories] = await Promise.all([listNotes(), listUserCategories("notes")]);
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load notes.";
  }

  return (
    <AppShell>
      <NotesPage initialNotes={notes} initialCategories={categories} authError={authError} />
    </AppShell>
  );
}
