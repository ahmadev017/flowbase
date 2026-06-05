"use client";

import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  GripVertical,
  Plus,
  Rows3,
} from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";

import {
  CalendarTaskDTO,
  CalendarTaskType,
  createCalendarTask,
  scheduleCalendarTask,
  updateCalendarTask,
} from "@/app/calendar/actions";
import type { UserCategoryDTO } from "@/app/settings/actions";
import { cn } from "@/lib/utils";

const fallbackCategories: UserCategoryDTO[] = [
  { id: 0, scope: "calendar", name: "Work", color: "#168f79", icon: "BriefcaseBusiness" },
  { id: 1, scope: "calendar", name: "Personal", color: "#dc6259", icon: "Heart" },
  { id: 2, scope: "calendar", name: "Focus", color: "#2d9cdb", icon: "Target" },
  { id: 3, scope: "calendar", name: "Meeting", color: "#df8a2f", icon: "Users" },
];
const fallbackReminderCategories: UserCategoryDTO[] = [
  { id: 10, scope: "reminders", name: "Follow-up", color: "#55cdb4", icon: "MessageCircle" },
  { id: 11, scope: "reminders", name: "Deadline", color: "#ef594a", icon: "AlarmClock" },
  { id: 12, scope: "reminders", name: "Personal", color: "#dc6259", icon: "Heart" },
  { id: 13, scope: "reminders", name: "Habit", color: "#168f79", icon: "Repeat2" },
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ViewMode = "month" | "week";
type DialogMode = "create" | "edit";

type DraftForm = {
  title: string;
  description: string;
  scheduledTime: string;
  type: CalendarTaskType;
  category: string;
  categoryColor: string;
};

const initialForm: DraftForm = {
  title: "",
  description: "",
  scheduledTime: "",
  type: "task",
  category: fallbackCategories[0].name,
  categoryColor: fallbackCategories[0].color,
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateToKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function formatLongDate(key: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(parseDateKey(key));
}

function formatNumericDate(key: string) {
  const date = parseDateKey(key);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay());
}

function buildMonthDays(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);

  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function buildWeekDays(anchor: Date) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function taskTypeStyle(type: CalendarTaskType) {
  return type === "reminder"
    ? "bg-[#fff7dd] text-[#7c6227] border-[#f3d681]"
    : "bg-[#eefbf7] text-[#28685c] border-[#bfeade]";
}

export function CalendarPage({
  initialTasks,
  initialCategories,
  authError,
}: {
  initialTasks: CalendarTaskDTO[];
  initialCategories?: UserCategoryDTO[];
  authError?: string;
}) {
  const categories = initialCategories?.length ? initialCategories : [...fallbackCategories, ...fallbackReminderCategories];
  const taskCategories = categories.filter((category) => category.scope === "calendar");
  const reminderCategories = categories.filter((category) => category.scope === "reminders");
  const defaultTaskCategory = taskCategories[0] ?? fallbackCategories[0];
  const today = useMemo(() => startOfDay(new Date()), []);
  const [tasks, setTasks] = useState(initialTasks);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(dateToKey(today));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [dayDetailsDate, setDayDetailsDate] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>({
    ...initialForm,
    category: defaultTaskCategory.name,
    categoryColor: defaultTaskCategory.color,
  });
  const [message, setMessage] = useState(authError ?? "");
  const [isPending, startTransition] = useTransition();

  const visibleDays = useMemo(
    () => (viewMode === "month" ? buildMonthDays(anchorDate) : buildWeekDays(anchorDate)),
    [anchorDate, viewMode]
  );
  const drafts = tasks.filter((task) => task.isDraft);
  const scheduledTasks = tasks.filter((task) => !task.isDraft && task.scheduledDate);
  const selectedTasks = scheduledTasks.filter((task) => task.scheduledDate === selectedDate);
  const activeCategories = form.type === "reminder" ? reminderCategories : taskCategories;
  const displayedCategories = activeCategories.length ? activeCategories : taskCategories;

  function tasksForDate(key: string) {
    return scheduledTasks
      .filter((task) => task.scheduledDate === key)
      .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
  }

  function updateTask(nextTask: CalendarTaskDTO) {
    setTasks((current) => current.map((task) => (task.id === nextTask.id ? nextTask : task)));
  }

  function resetForm() {
    setForm({
      ...initialForm,
      category: defaultTaskCategory.name,
      categoryColor: defaultTaskCategory.color,
    });
    setActiveTaskId(null);
    setDialogMode("create");
  }

  function openDialogForDate(key: string) {
    setSelectedDate(key);
    resetForm();
    setDayDetailsDate(null);
    setDialogOpen(true);
  }

  function openEditDialog(task: CalendarTaskDTO) {
    if (!task.scheduledDate) {
      return;
    }

    setSelectedDate(task.scheduledDate);
    setDayDetailsDate(null);
    setForm({
      title: task.title,
      description: task.description,
      scheduledTime: task.scheduledTime ?? "",
      type: task.type,
      category: task.category,
      categoryColor: task.categoryColor,
    });
    setActiveTaskId(task.id);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function navigate(amount: number) {
    setAnchorDate((current) => {
      const next = new Date(current);
      if (viewMode === "month") {
        next.setMonth(current.getMonth() + amount);
      } else {
        next.setDate(current.getDate() + amount * 7);
      }
      return startOfDay(next);
    });
  }

  function jumpToToday() {
    const key = dateToKey(today);
    setAnchorDate(today);
    setSelectedDate(key);
  }

  function handleCategoryChange(label: string) {
    const category = displayedCategories.find((item) => item.name === label) ?? displayedCategories[0];
    setForm((current) => ({
      ...current,
      category: category.name,
      categoryColor: category.color,
    }));
  }

  function handleTypeChange(type: CalendarTaskType) {
    const nextCategories = type === "reminder" ? reminderCategories : taskCategories;
    const category = nextCategories[0] ?? defaultTaskCategory;

    setForm((current) => ({
      ...current,
      type,
      category: category.name,
      categoryColor: category.color,
    }));
  }

  function saveTask(isDraft: boolean) {
    startTransition(async () => {
      setMessage("");
      try {
        if (dialogMode === "edit" && activeTaskId) {
          const updatedTask = await updateCalendarTask(activeTaskId, {
            ...form,
            scheduledDate: selectedDate,
            isDraft,
          });
          updateTask(updatedTask);
          setDialogOpen(false);
          resetForm();
          return;
        }

        const nextTask = await createCalendarTask({
          ...form,
          scheduledDate: selectedDate,
          isDraft,
        });
        setTasks((current) => [nextTask, ...current]);
        setDialogOpen(false);
        resetForm();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save task.");
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveTask(false);
  }

  function handleDragStart(event: React.DragEvent, taskId: number) {
    event.dataTransfer.setData("application/x-flowbase-task-id", String(taskId));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: React.DragEvent, dateKey: string) {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData("application/x-flowbase-task-id"));

    if (!taskId) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const updatedTask = await scheduleCalendarTask(taskId, dateKey);
        updateTask(updatedTask);
        setSelectedDate(dateKey);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to reschedule task.");
      }
    });
  }

  function openDayDetails(event: React.MouseEvent, key: string) {
    event.stopPropagation();
    setSelectedDate(key);
    setDayDetailsDate(key);
  }

  function closeDayDetails() {
    setDayDetailsDate(null);
  }

  function addTaskFromDayDetails() {
    if (!dayDetailsDate) {
      return;
    }

    openDialogForDate(dayDetailsDate);
  }

  const weekRange =
    viewMode === "week"
      ? `${formatShortDate(visibleDays[0])} - ${formatShortDate(visibleDays[6])}`
      : null;
  const dayDetailsTasks = dayDetailsDate ? tasksForDate(dayDetailsDate) : [];

  return (
    <>
      <header className="border-b border-[#e1d8c8] pb-8">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-[#d85749]">
            <CalendarDays className="h-4 w-4 text-teal-600" aria-hidden="true" />
            Calendar
          </p>
          <h1 className="mt-3 max-w-5xl text-3xl font-bold leading-tight tracking-tight text-[#111827] lg:text-4xl">
            Schedule the work, hold the maybes.
          </h1>
          <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-[#5f5b55]">
            Add tasks and reminders to dates, keep unscheduled drafts nearby, and drag work into
            place when the plan firms up.
          </p>
        </div>
      </header>

      {message ? (
        <div className="mt-4 rounded-md border border-[#f0c7c1] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#944139]">
          {message}
        </div>
      ) : null}

      <div className="mt-7 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8dfcf] bg-white px-5 py-5">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-[#171717]">
                {viewMode === "month" ? formatMonth(anchorDate) : weekRange}
              </h2>
              <p className="mt-1 text-sm font-medium text-[#6b675f]">
                Drop drafts or scheduled items onto any date.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-[#e1d8c8] bg-[#fffaf0] p-1 shadow-sm">
                {(["month", "week"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "h-10 rounded px-4 text-sm font-bold capitalize text-[#6b675f] transition",
                      viewMode === mode && "bg-[#ef594a] text-white shadow-sm"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={jumpToToday}
                className="flex h-11 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
              >
                <CalendarDays className="h-4 w-4 text-teal-600" aria-hidden="true" />
                Today
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Previous period"
                className="grid h-11 w-11 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#57534e] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                aria-label="Next period"
                className="grid h-11 w-11 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#57534e] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => openDialogForDate(selectedDate)}
                className="flex h-11 items-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New task
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-[#e8dfcf] bg-[#fffaf0]">
            {weekdays.map((day) => (
              <div key={day} className="px-2 py-3 text-center text-xs font-bold uppercase tracking-[0.08em] text-[#8a867d]">
                {day}
              </div>
            ))}
          </div>
          <div className={cn("grid grid-cols-7", viewMode === "month" ? "auto-rows-[minmax(170px,1fr)]" : "auto-rows-[minmax(430px,1fr)]")}>
            {visibleDays.map((day) => {
              const key = dateToKey(day);
              const dayTasks = tasksForDate(key);
              const visibleTaskLimit = viewMode === "month" ? 3 : 8;
              const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
              const isToday = key === dateToKey(today);
              const isSelected = key === selectedDate;

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDate(key)}
                  onDoubleClick={() => openDialogForDate(key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDate(key);
                    }
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, key)}
                  className={cn(
                    "group min-w-0 border-b border-r border-[#eee7dc] bg-white p-3 text-left align-top transition hover:bg-[#fffaf0]",
                    !isCurrentMonth && viewMode === "month" && "bg-[#fdfaf3] text-[#aaa49a]",
                    isSelected && "bg-[#eafafa]",
                    isToday && "shadow-[inset_0_0_0_2px_#ef594a]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-md text-sm font-bold",
                        isToday ? "bg-[#ef594a] text-white" : "text-[#403c37]"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDialogForDate(key);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md text-[#8a867d] opacity-0 transition hover:bg-white hover:text-[#ef594a] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label={`Add task on ${key}`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {dayTasks.slice(0, visibleTaskLimit).map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(event) => handleDragStart(event, task.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditDialog(task);
                        }}
                        className={cn(
                          "min-w-0 cursor-pointer rounded-md border px-2 py-1.5 text-xs font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
                          taskTypeStyle(task.type)
                        )}
                        style={{ borderLeft: `4px solid ${task.categoryColor}` }}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          {task.type === "reminder" ? (
                            <Bell className="h-3 w-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <Rows3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate">{task.title}</span>
                        </div>
                        {task.scheduledTime ? (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold opacity-75">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {task.scheduledTime}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {dayTasks.length > visibleTaskLimit ? (
                      <button
                        type="button"
                        onClick={(event) => openDayDetails(event, key)}
                        className="truncate rounded px-1.5 py-1 text-left text-xs font-bold text-[#6b675f] transition hover:bg-white hover:text-[#ef594a] focus-visible:bg-white focus-visible:text-[#ef594a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fee4df]"
                      >
                        +{dayTasks.length - visibleTaskLimit} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="min-w-0 self-start rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#171717]">Draft Task Panel</h2>
            <span className="grid h-8 min-w-8 place-items-center rounded-md bg-[#fffaf0] px-2 text-sm font-bold text-[#8a867d]">
              {drafts.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
          >
            <Plus className="h-4 w-4 text-[#ef594a]" aria-hidden="true" />
            Add draft
          </button>

          <div className="mt-4 space-y-3">
            {drafts.length ? (
              drafts.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, task.id)}
                  className={cn(
                    "cursor-grab rounded-md border p-3 shadow-sm active:cursor-grabbing",
                    taskTypeStyle(task.type)
                  )}
                  style={{ borderLeft: `5px solid ${task.categoryColor}` }}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold opacity-75">
                        {task.description || "No description yet"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="rounded bg-white/70 px-2 py-1">{task.category}</span>
                        {task.scheduledTime ? <span>{task.scheduledTime}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-5 py-8 text-center">
                <Inbox className="mx-auto h-6 w-6 text-[#6b675f]" aria-hidden="true" />
                <p className="mt-4 text-base font-bold text-[#292524]">No drafts waiting</p>
                <p className="mx-auto mt-2 max-w-[240px] text-sm font-medium leading-6 text-[#6b675f]">
                  Save unscheduled tasks here, then drag them onto a date.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {dayDetailsDate ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#111827]/30 p-4 backdrop-blur-sm">
          <section className="my-6 w-full max-w-[520px] rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#d85749]">Scheduled items</p>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  Tasks for {formatLongDate(dayDetailsDate)}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#6b675f]">
                  {dayDetailsTasks.length} {dayDetailsTasks.length === 1 ? "task" : "tasks"} on this date
                </p>
              </div>
              <button
                type="button"
                onClick={closeDayDetails}
                className="rounded-md px-3 py-2 text-sm font-bold text-[#403c37] transition hover:bg-[#fffaf0] hover:text-[#ef594a]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 max-h-[56vh] space-y-3 overflow-y-auto pr-1">
              {dayDetailsTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openEditDialog(task)}
                  className={cn(
                    "w-full rounded-md border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    taskTypeStyle(task.type)
                  )}
                  style={{ borderLeft: `5px solid ${task.categoryColor}` }}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/70">
                      {task.type === "reminder" ? (
                        <Bell className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Rows3 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-bold">{task.title}</p>
                        <span className="rounded bg-white/70 px-2 py-1 text-[11px] font-bold">
                          {task.category}
                        </span>
                      </div>
                      {task.description ? (
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 opacity-75">
                          {task.description}
                        </p>
                      ) : null}
                      {task.scheduledTime ? (
                        <p className="mt-2 flex items-center gap-1 text-xs font-bold opacity-75">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {task.scheduledTime}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDayDetails}
                className="h-11 rounded-md border border-[#e1d8c8] bg-white px-5 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={addTaskFromDayDetails}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add task
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111827]/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="my-6 w-full max-w-[680px] rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">
                  {dialogMode === "edit" ? "Edit calendar item" : "Create calendar item"}
                </h2>
                <p className="mt-2 text-base font-bold text-[#6b675f]">
                  Selected date: {formatNumericDate(selectedDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-bold text-[#403c37] transition hover:bg-[#fffaf0] hover:text-[#ef594a]"
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                Task title
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  placeholder="Write the next thing to remember"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-28 resize-none rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 py-3 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  placeholder="Add helpful context"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                  Time
                  <input
                    type="time"
                    value={form.scheduledTime}
                    onChange={(event) => setForm((current) => ({ ...current, scheduledTime: event.target.value }))}
                    className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                  Type
                  <select
                    value={form.type}
                    onChange={(event) => handleTypeChange(event.target.value as CalendarTaskType)}
                    className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  >
                    <option value="task">Task</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-bold text-[#403c37]">Category</p>
                <div className="flex flex-wrap gap-3">
                  {displayedCategories.map((category) => (
                    <button
                      key={category.id || category.name}
                      type="button"
                      onClick={() => handleCategoryChange(category.name)}
                      className={cn(
                        "flex h-11 min-w-0 items-center justify-center gap-2 rounded-md border px-4 text-sm font-bold shadow-sm transition",
                        form.category === category.name
                          ? "ring-2 ring-[#ef594a]/70"
                          : "opacity-90 hover:opacity-100"
                      )}
                      style={{
                        backgroundColor: `${category.color}18`,
                        borderColor: `${category.color}55`,
                        color: "#403c37",
                      }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="truncate">{category.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={() => saveTask(true)}
                className="h-12 rounded-md border border-[#e1d8c8] bg-white px-6 text-base font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] disabled:opacity-60"
              >
                Save draft
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="h-12 rounded-md bg-[#ef594a] px-6 text-base font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
              >
                {dialogMode === "edit" ? "Save changes" : "Schedule"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
