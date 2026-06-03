import { AppShell } from "@/components/app-shell";
import { NotesPage } from "@/components/notes-page";

import { NoteDTO, listNotes } from "./actions";

export default async function NotesRoute() {
  let notes: NoteDTO[] = [];
  let authError: string | undefined;

  try {
    notes = await listNotes();
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load notes.";
  }

  return (
    <AppShell>
      <NotesPage initialNotes={notes} authError={authError} />
    </AppShell>
  );
}
