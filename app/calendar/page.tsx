import { AppShell } from "@/components/app-shell";
import { CalendarPage } from "@/components/calendar-page";

import { CalendarTaskDTO, listCalendarTasks } from "./actions";

export default async function CalendarRoute() {
  let tasks: CalendarTaskDTO[] = [];
  let authError: string | undefined;

  try {
    tasks = await listCalendarTasks();
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load calendar tasks.";
  }

  return (
    <AppShell>
      <CalendarPage initialTasks={tasks} authError={authError} />
    </AppShell>
  );
}
