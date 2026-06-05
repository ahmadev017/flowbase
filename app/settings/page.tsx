import { AppShell } from "@/components/app-shell";
import { SettingsPage } from "@/components/settings-page";

import { getSettingsPageData, type SettingsPageDTO } from "./actions";

export default async function SettingsRoute() {
  let data: SettingsPageDTO | null = null;
  let authError: string | undefined;

  try {
    data = await getSettingsPageData();
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load settings.";
  }

  return (
    <AppShell>
      <SettingsPage initialData={data} authError={authError} />
    </AppShell>
  );
}
