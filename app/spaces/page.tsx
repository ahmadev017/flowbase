import { AppShell } from "@/components/app-shell";
import { PagesSpacesPage } from "@/components/pages-spaces-page";

import { SpacesPayload, listSpaces } from "./actions";

export default async function SpacesRoute() {
  let payload: SpacesPayload = { spaces: [], pages: [] };
  let authError: string | undefined;

  try {
    payload = await listSpaces();
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load spaces.";
  }

  return (
    <AppShell>
      <PagesSpacesPage initialPayload={payload} authError={authError} />
    </AppShell>
  );
}
