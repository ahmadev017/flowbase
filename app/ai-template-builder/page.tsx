import { AppShell } from "@/components/app-shell";
import { AiTemplateBuilderPage } from "@/components/ai-template-builder-page";

import { GeneratedAppDTO, listGeneratedApps } from "./actions";

export default async function AiTemplateBuilderRoute() {
  let apps: GeneratedAppDTO[] = [];
  let authError: string | undefined;

  try {
    apps = await listGeneratedApps();
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load generated apps.";
  }

  return (
    <AppShell>
      <AiTemplateBuilderPage initialApps={apps} authError={authError} />
    </AppShell>
  );
}
