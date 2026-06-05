import { AppShell } from "@/components/app-shell";
import { CalendarPage } from "@/components/calendar-page";

import { CalendarTaskDTO, listCalendarTasks } from "./actions";
import { listUserCategories, type UserCategoryDTO } from "@/app/settings/actions";

export default async function CalendarRoute() {
  let tasks: CalendarTaskDTO[] = [];
  let categories: UserCategoryDTO[] = [];
  let authError: string | undefined;

  try {
    const [loadedTasks, calendarCategories, reminderCategories] = await Promise.all([
      listCalendarTasks(),
      listUserCategories("calendar"),
      listUserCategories("reminders"),
    ]);
    tasks = loadedTasks;
    categories = [...calendarCategories, ...reminderCategories];
  } catch (error) {
    authError = error instanceof Error ? error.message : "Unable to load calendar tasks.";
  }

  return (
    <AppShell>
      <CalendarPage initialTasks={tasks} initialCategories={categories} authError={authError} />
    </AppShell>
  );
}
