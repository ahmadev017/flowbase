"use client";

import {
  CalendarDays,
  Check,
  CircleDot,
  Columns3,
  FileText,
  GripVertical,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Settings,
  Share2,
  Sparkles,
  Tags,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ClientSideSuspense, RoomProvider, useOthers, useSelf, useThreads, useUpdateMyPresence } from "@liveblocks/react";
import { Composer, Thread } from "@liveblocks/react-ui";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

import {
  BoardCollaboratorDTO,
  KanbanBoardDTO,
  KanbanLabel,
  KanbanPriority,
  KanbanTaskDTO,
  createKanbanBoard,
  createKanbanColumn,
  deleteKanbanBoard,
  createKanbanTask,
  deleteKanbanColumn,
  deleteKanbanTask,
  inviteBoardCollaborator,
  listBoardCollaborators,
  moveKanbanTask,
  updateKanbanBoard,
  updateKanbanColumn,
  updateKanbanTask,
} from "@/app/kanban/actions";
import { cn } from "@/lib/utils";

const boardColors = ["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259"];
const labelOptions: KanbanLabel[] = [
  { name: "Focus", color: "#55cdb4" },
  { name: "Design", color: "#ef594a" },
  { name: "Meeting", color: "#f4b333" },
  { name: "Research", color: "#8b5cf6" },
  { name: "Admin", color: "#2d9cdb" },
];
const priorityStyles: Record<KanbanPriority, string> = {
  Low: "border-[#bfeade] bg-[#eefbf7] text-[#28685c]",
  Medium: "border-[#f0d98c] bg-[#fff7dd] text-[#7c6227]",
  High: "border-[#f0c7c1] bg-[#fff0ed] text-[#944139]",
};

type TaskDialogState =
  | { mode: "create"; columnId: number; task: null }
  | { mode: "edit"; columnId: number; task: KanbanTaskDTO };

type CommentPanelState = {
  boardId: number;
  task: KanbanTaskDTO;
} | null;

type TaskForm = {
  columnId: number;
  title: string;
  description: string;
  dueDate: string;
  priority: KanbanPriority;
  labels: KanbanLabel[];
  syncCalendar: boolean;
  linkNotes: boolean;
};

function todayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDueDate(value: string) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function emptyTaskForm(columnId = 0): TaskForm {
  return {
    columnId,
    title: "",
    description: "",
    dueDate: todayKey(),
    priority: "Medium",
    labels: [],
    syncCalendar: false,
    linkNotes: false,
  };
}

function taskToForm(task: KanbanTaskDTO): TaskForm {
  return {
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate || todayKey(),
    priority: task.priority,
    labels: task.labels,
    syncCalendar: task.syncCalendar,
    linkNotes: task.linkNotes,
  };
}

function getRoomId(boardId: number) {
  return `flowbase:kanban-board:${boardId}`;
}

function getInitials(nameOrEmail: string) {
  const [first, second] = nameOrEmail
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return `${first?.[0] ?? "U"}${second?.[0] ?? ""}`.toUpperCase();
}

function KanbanLiveRoom({ boardId, children }: { boardId: number; children: React.ReactNode }) {
  return (
    <RoomProvider id={getRoomId(boardId)} initialPresence={{ status: "active" }}>
      <ClientSideSuspense fallback={<div className="p-4 text-sm font-bold text-[#6b675f]">Loading collaboration...</div>}>
        {children}
      </ClientSideSuspense>
    </RoomProvider>
  );
}

function CollaboratorAvatars() {
  const self = useSelf();
  const others = useOthers();
  const collaborators = [
    ...(self ? [{ id: "self", info: self.info, isSelf: true }] : []),
    ...others.map((other) => ({ id: String(other.connectionId), info: other.info, isSelf: false })),
  ];

  if (!collaborators.length) {
    return null;
  }

  return (
    <div className="flex items-center -space-x-2">
      {collaborators.slice(0, 5).map((collaborator) => {
        const label = collaborator.info.name || collaborator.info.email;

        return (
          <div
            key={collaborator.id}
            title={`${label}${collaborator.isSelf ? " (you)" : ""}`}
            className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-white text-xs font-black text-white shadow-sm"
            style={{ backgroundColor: collaborator.info.color }}
          >
            {collaborator.info.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={collaborator.info.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(label)
            )}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#3dbb76]" />
          </div>
        );
      })}
      {collaborators.length > 5 ? (
        <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#292524] text-xs font-black text-white shadow-sm">
          +{collaborators.length - 5}
        </div>
      ) : null}
    </div>
  );
}

function CollaborationPanel({
  board,
  onClose,
}: {
  board: KanbanBoardDTO;
  onClose: () => void;
}) {
  const [collaborators, setCollaborators] = useState<BoardCollaboratorDTO[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    startTransition(async () => {
      try {
        const items = await listBoardCollaborators(board.id);
        if (mounted) {
          setCollaborators(items);
        }
      } catch (error) {
        if (mounted) {
          setMessage(error instanceof Error ? error.message : "Unable to load collaborators.");
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [board.id]);

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage("");
      try {
        const items = await inviteBoardCollaborator(board.id, email);
        setCollaborators(items);
        setEmail("");
        setMessage("Invite saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to invite collaborator.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#111827]/35 p-0 backdrop-blur-sm sm:p-4">
      <aside className="h-full w-full overflow-y-auto border-l border-[#e1d8c8] bg-white p-5 shadow-xl sm:max-w-[420px] sm:rounded-lg sm:border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-[#d85749]">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Collaboration
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#111827]">{board.name}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
              Invite teammates and see who can open this board.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
            aria-label="Close collaboration panel"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleInvite} className="mt-6 rounded-lg border border-[#e8dfcf] bg-[#fffaf0] p-4">
          <label className="grid gap-2 text-sm font-bold text-[#403c37]">
            Invite by email
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-md border border-[#e1d8c8] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                placeholder="teammate@example.com"
              />
              <button
                type="submit"
                disabled={isPending}
                className="grid h-11 w-11 place-items-center rounded-md bg-[#ef594a] text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
                aria-label="Invite collaborator"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </label>
        </form>

        {message ? (
          <div className="mt-4 rounded-md border border-[#e1d8c8] bg-white px-4 py-3 text-sm font-bold text-[#6b675f]">
            {message}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {collaborators.length ? (
            collaborators.map((collaborator) => (
              <div
                key={collaborator.id}
                className="flex items-center gap-3 rounded-lg border border-[#e8dfcf] bg-white p-3 shadow-sm"
              >
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-black text-white"
                  style={{ backgroundColor: collaborator.color }}
                >
                  {collaborator.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={collaborator.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(collaborator.name || collaborator.email)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#292524]">{collaborator.name}</p>
                  <p className="truncate text-xs font-semibold text-[#6b675f]">{collaborator.email}</p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-black uppercase",
                    collaborator.status === "owner" && "bg-[#fee4df] text-[#944139]",
                    collaborator.status === "active" && "bg-[#eefbf7] text-[#28685c]",
                    collaborator.status === "pending" && "bg-[#fff7dd] text-[#7c6227]"
                  )}
                >
                  {collaborator.status}
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-5 py-8 text-center">
              <Users className="mx-auto h-6 w-6 text-[#6b675f]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[#292524]">No collaborators yet</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function TaskCommentButton({
  boardId,
  task,
  onOpen,
}: {
  boardId: number;
  task: KanbanTaskDTO;
  onOpen: () => void;
}) {
  const { threads } = useThreads({
    query: { metadata: { kind: "kanban-task", boardId: String(boardId), taskId: String(task.id) } },
  });
  const count = threads?.reduce((sum, thread) => sum + thread.comments.length, 0) ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-8 items-center gap-1.5 rounded-md border border-[#e1d8c8] bg-white px-2.5 text-xs font-bold text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
      aria-label={`Open comments for ${task.title}`}
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {count ? <span>{count}</span> : null}
    </button>
  );
}

function TaskCommentsPanel({ state, onClose }: { state: NonNullable<CommentPanelState>; onClose: () => void }) {
  const updatePresence = useUpdateMyPresence();
  const { threads } = useThreads({
    query: {
      metadata: {
        kind: "kanban-task",
        boardId: String(state.boardId),
        taskId: String(state.task.id),
      },
    },
  });

  useEffect(() => {
    updatePresence({ selectedTaskId: state.task.id });
    return () => updatePresence({ selectedTaskId: null });
  }, [state.task.id, updatePresence]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#111827]/35 p-0 backdrop-blur-sm sm:p-4">
      <aside className="h-full w-full overflow-y-auto border-l border-[#e1d8c8] bg-white p-5 shadow-xl sm:max-w-[520px] sm:rounded-lg sm:border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-black text-[#d85749]">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Task comments
            </p>
            <h2 className="mt-2 line-clamp-2 text-2xl font-bold text-[#111827]">{state.task.title}</h2>
            {state.task.description ? (
              <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">{state.task.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
            aria-label="Close task comments"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {threads?.length ? (
            threads.map((thread) => (
              <Thread key={thread.id} thread={thread} showResolveAction={false} className="rounded-lg border border-[#e8dfcf] bg-[#fffaf0] p-3" />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-5 py-8 text-center">
              <MessageCircle className="mx-auto h-6 w-6 text-[#6b675f]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[#292524]">No comments yet</p>
              <p className="mt-1 text-sm font-semibold text-[#6b675f]">Start the thread with the first update.</p>
            </div>
          )}

          {!threads?.length ? (
            <Composer
              metadata={{ kind: "kanban-task", boardId: String(state.boardId), taskId: String(state.task.id) }}
              className="rounded-lg border border-[#e8dfcf] bg-white p-3"
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function KanbanPage({
  initialBoards,
  authError,
}: {
  initialBoards: KanbanBoardDTO[];
  authError?: string;
}) {
  const [boards, setBoards] = useState(initialBoards);
  const [selectedBoardId, setSelectedBoardId] = useState(initialBoards[0]?.id ?? null);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<number | null>(null);
  const [boardToDelete, setBoardToDelete] = useState<KanbanBoardDTO | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<KanbanBoardDTO["columns"][number] | null>(null);
  const [collaborationBoard, setCollaborationBoard] = useState<KanbanBoardDTO | null>(null);
  const [commentPanel, setCommentPanel] = useState<CommentPanelState>(null);
  const [boardName, setBoardName] = useState("");
  const [boardColor, setBoardColor] = useState(boardColors[0]);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null);
  const [columnName, setColumnName] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [message, setMessage] = useState(authError ?? "");
  const [isPending, startTransition] = useTransition();

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? boards[0] ?? null,
    [boards, selectedBoardId]
  );

  function replaceBoard(nextBoard: KanbanBoardDTO) {
    setBoards((current) => current.map((board) => (board.id === nextBoard.id ? nextBoard : board)));
  }

  function openCreateBoardDialog() {
    setEditingBoardId(null);
    setBoardName("");
    setBoardColor(boardColors[0]);
    setBoardDialogOpen(true);
  }

  function openEditBoardDialog(board: KanbanBoardDTO) {
    setEditingBoardId(board.id);
    setBoardName(board.name);
    setBoardColor(board.color);
    setBoardDialogOpen(true);
  }

  function updateBoardColumns(boardId: number, updater: (columns: KanbanBoardDTO["columns"]) => KanbanBoardDTO["columns"]) {
    setBoards((current) =>
      current.map((board) => (board.id === boardId ? { ...board, columns: updater(board.columns) } : board))
    );
  }

  function openCreateTask(columnId: number) {
    setTaskForm(emptyTaskForm(columnId));
    setTaskDialog({ mode: "create", columnId, task: null });
  }

  function openEditTask(columnId: number, task: KanbanTaskDTO) {
    setTaskForm(taskToForm(task));
    setTaskDialog({ mode: "edit", columnId, task });
  }

  function toggleLabel(label: KanbanLabel) {
    setTaskForm((current) => {
      const exists = current.labels.some((item) => item.name === label.name);
      return {
        ...current,
        labels: exists
          ? current.labels.filter((item) => item.name !== label.name)
          : [...current.labels, label],
      };
    });
  }

  function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage("");
      try {
        if (editingBoardId) {
          const currentBoard = boards.find((item) => item.id === editingBoardId);
          const updatedBoard = await updateKanbanBoard(editingBoardId, { name: boardName, color: boardColor });
          replaceBoard({ ...updatedBoard, columns: currentBoard?.columns ?? [] });
        } else {
          const board = await createKanbanBoard({ name: boardName, color: boardColor });
          setBoards((current) => [...current, board]);
          setSelectedBoardId(board.id);
        }
        setBoardName("");
        setBoardColor(boardColors[0]);
        setEditingBoardId(null);
        setBoardDialogOpen(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save board.");
      }
    });
  }

  function handleDeleteBoard(boardId: number) {
    startTransition(async () => {
      setMessage("");
      try {
        await deleteKanbanBoard(boardId);
        setBoards((current) => {
          const nextBoards = current.filter((board) => board.id !== boardId);
          if (selectedBoardId === boardId) {
            setSelectedBoardId(nextBoards[0]?.id ?? null);
          }
          return nextBoards;
        });
        setBoardToDelete(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete board.");
      }
    });
  }

  function handleCreateColumn() {
    if (!selectedBoard || selectedBoard.columns.length >= 5) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const column = await createKanbanColumn(selectedBoard.id, newColumnName);
        updateBoardColumns(selectedBoard.id, (columns) => [...columns, column]);
        setNewColumnName("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create column.");
      }
    });
  }

  function handleSaveColumn(columnId: number) {
    if (!selectedBoard) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const column = await updateKanbanColumn(columnId, columnName);
        updateBoardColumns(selectedBoard.id, (columns) =>
          columns.map((item) => (item.id === columnId ? { ...item, name: column.name } : item))
        );
        setEditingColumnId(null);
        setColumnName("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to rename column.");
      }
    });
  }

  function handleDeleteColumn(columnId: number) {
    if (!selectedBoard) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        await deleteKanbanColumn(columnId);
        updateBoardColumns(selectedBoard.id, (columns) => columns.filter((column) => column.id !== columnId));
        setColumnToDelete(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete column.");
      }
    });
  }

  function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBoard || !taskDialog) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        if (taskDialog.mode === "edit") {
          const updatedTask = await updateKanbanTask(taskDialog.task.id, taskForm);
          const columnChanged = taskForm.columnId !== taskDialog.task.columnId;
          const targetColumn = selectedBoard.columns.find((column) => column.id === taskForm.columnId);
          const finalTask = columnChanged
            ? await moveKanbanTask(
                updatedTask.id,
                taskForm.columnId,
                targetColumn?.tasks.filter((task) => task.id !== updatedTask.id).length ?? 0
              )
            : updatedTask;
          updateBoardColumns(selectedBoard.id, (columns) =>
            columns.map((column) => {
              if (columnChanged) {
                const withoutTask = column.tasks.filter((task) => task.id !== finalTask.id);
                return column.id === finalTask.columnId
                  ? { ...column, tasks: [...withoutTask, finalTask] }
                  : { ...column, tasks: withoutTask };
              }

              return {
                ...column,
                tasks: column.tasks.map((task) => (task.id === finalTask.id ? finalTask : task)),
              };
            })
          );
        } else {
          const task = await createKanbanTask(taskForm.columnId || taskDialog.columnId, taskForm);
          updateBoardColumns(selectedBoard.id, (columns) =>
            columns.map((column) =>
              column.id === task.columnId ? { ...column, tasks: [...column.tasks, task] } : column
            )
          );
        }

        setTaskDialog(null);
        setTaskForm(emptyTaskForm());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save task.");
      }
    });
  }

  function handleDeleteTask(taskId: number) {
    if (!selectedBoard) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        await deleteKanbanTask(taskId);
        updateBoardColumns(selectedBoard.id, (columns) =>
          columns.map((column) => ({
            ...column,
            tasks: column.tasks.filter((task) => task.id !== taskId),
          }))
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete task.");
      }
    });
  }

  function handleDragStart(event: React.DragEvent, taskId: number) {
    event.dataTransfer.setData("application/x-flowbase-kanban-task-id", String(taskId));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: React.DragEvent, targetColumnId: number) {
    event.preventDefault();
    if (!selectedBoard) {
      return;
    }

    const taskId = Number(event.dataTransfer.getData("application/x-flowbase-kanban-task-id"));
    const sourceColumn = selectedBoard.columns.find((column) => column.tasks.some((task) => task.id === taskId));
    const task = sourceColumn?.tasks.find((item) => item.id === taskId);

    if (!task || !sourceColumn) {
      return;
    }

    const targetColumn = selectedBoard.columns.find((column) => column.id === targetColumnId);
    const nextPosition = targetColumn?.tasks.filter((item) => item.id !== taskId).length ?? 0;

    updateBoardColumns(selectedBoard.id, (columns) =>
      columns.map((column) => {
        if (column.id === sourceColumn.id && column.id !== targetColumnId) {
          return { ...column, tasks: column.tasks.filter((item) => item.id !== taskId) };
        }

        if (column.id === targetColumnId) {
          const existingTasks = column.tasks.filter((item) => item.id !== taskId);
          return {
            ...column,
            tasks: [...existingTasks, { ...task, columnId: targetColumnId, position: nextPosition }],
          };
        }

        return column;
      })
    );

    startTransition(async () => {
      try {
        await moveKanbanTask(taskId, targetColumnId, nextPosition);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to move task.");
      }
    });
  }

  const totalTasks = selectedBoard?.columns.reduce((sum, column) => sum + column.tasks.length, 0) ?? 0;

  return (
    <>
      <header className="border-b border-[#e1d8c8] pb-8">
        <p className="flex items-center gap-2 text-sm font-bold text-[#d85749]">
          <Columns3 className="h-4 w-4 text-amber-600" aria-hidden="true" />
          Task / Kanban
        </p>
        <h1 className="mt-3 max-w-5xl text-3xl font-bold leading-tight tracking-tight text-[#111827] lg:text-4xl">
          Shape the work into calm, movable lanes.
        </h1>
        <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-[#5f5b55]">
          Create boards, sort tasks into columns, and keep calendar-linked work visible where it belongs.
        </p>
      </header>

      {message ? (
        <div className="mt-4 rounded-md border border-[#f0c7c1] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#944139]">
          {message}
        </div>
      ) : null}

      <div className="mt-7 grid min-w-0 gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="flex h-[calc(100vh-220px)] min-h-[560px] min-w-0 flex-col rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[#171717]">Boards</h2>
              <p className="mt-1 text-sm font-semibold text-[#6b675f]">{boards.length} saved</p>
            </div>
            <button
              type="button"
              onClick={openCreateBoardDialog}
              aria-label="Create board"
              className="grid h-10 w-10 place-items-center rounded-md bg-[#ef594a] text-white shadow-sm transition hover:bg-[#dc4d40]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
              onClick={openCreateBoardDialog}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
          >
            <Sparkles className="h-4 w-4 text-[#ef594a]" aria-hidden="true" />
            New Kanban board
          </button>

          <div className="mt-5 pt-0.5 flex-1 space-y-2 overflow-y-auto pr-1">
            {boards.length ? (
              boards.map((board) => (
                <div
                  key={board.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#ef594a] hover:bg-[#fffaf0]",
                    selectedBoard?.id === board.id
                      ? "border-[#f0c7c1] bg-[#fee4df]"
                      : "border-[#e8dfcf] bg-white"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBoardId(board.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#292524]">{board.name}</span>
                  </button>
                  <span className="rounded bg-white/70 px-2 py-1 text-[11px] font-bold text-[#6b675f]">
                    {board.columns.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditBoardDialog(board)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
                    aria-label={`Edit ${board.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardToDelete(board)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#f0c7c1] bg-[#fff5f2] text-[#944139] transition hover:bg-[#fee4df]"
                    aria-label={`Delete ${board.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-5 py-8 text-center">
                <Columns3 className="mx-auto h-6 w-6 text-[#6b675f]" aria-hidden="true" />
                <p className="mt-4 text-base font-bold text-[#292524]">No boards yet</p>
                <p className="mx-auto mt-2 max-w-[220px] text-sm font-medium leading-6 text-[#6b675f]">
                  Create a board to start arranging your tasks.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-lg border border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
          {selectedBoard ? (
            <KanbanLiveRoom boardId={selectedBoard.id}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8dfcf] bg-white px-5 py-5">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: selectedBoard.color }} />
                    <h2 className="min-w-0 truncate text-2xl font-bold tracking-tight text-[#171717]">
                      {selectedBoard.name}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#6b675f]">
                    {selectedBoard.columns.length}/5 columns · {totalTasks} tasks
                  </p>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <CollaboratorAvatars />
                  <button
                    type="button"
                    onClick={() => setCollaborationBoard(selectedBoard)}
                    className="flex h-11 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
                  >
                    <Settings className="h-4 w-4 text-[#6b675f]" aria-hidden="true" />
                    Collaboration
                  </button>
                  <input
                    value={newColumnName}
                    onChange={(event) => setNewColumnName(event.target.value)}
                    disabled={selectedBoard.columns.length >= 5}
                    className="h-11 w-full min-w-0 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-sm font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df] disabled:opacity-60 sm:w-[190px]"
                    placeholder={selectedBoard.columns.length >= 5 ? "Column limit reached" : "Column name"}
                  />
                  <button
                    type="button"
                    onClick={handleCreateColumn}
                    disabled={isPending || selectedBoard.columns.length >= 5}
                    className="flex h-11 items-center gap-2 rounded-md bg-[#ef594a] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add column
                  </button>
                </div>
              </div>

              <div className="min-w-0 overflow-x-auto bg-[#fffaf0] p-4">
                <div className="flex min-h-[560px] w-max max-w-none gap-4 pb-2">
                  {selectedBoard.columns.map((column) => (
                    <div
                      key={column.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, column.id)}
                      className="flex w-[300px] max-w-[82vw] shrink-0 flex-col rounded-lg border border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]"
                    >
                      <div className="border-b border-[#e8dfcf] p-4">
                        <div className="flex items-center gap-2">
                          <CircleDot className="h-4 w-4 shrink-0 text-[#55cdb4]" aria-hidden="true" />
                          {editingColumnId === column.id ? (
                            <input
                              autoFocus
                              value={columnName}
                              onChange={(event) => setColumnName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  handleSaveColumn(column.id);
                                }
                              }}
                              className="h-9 min-w-0 flex-1 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-sm font-bold outline-none focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                            />
                          ) : (
                            <h3 className="min-w-0 flex-1 truncate text-base font-bold text-[#292524]">
                              {column.name}
                            </h3>
                          )}
                          <span className="rounded bg-[#fffaf0] px-2 py-1 text-xs font-bold text-[#8a867d]">
                            {column.tasks.length}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          {editingColumnId === column.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveColumn(column.id)}
                                className="grid h-9 w-9 place-items-center rounded-md border border-[#c9eadf] bg-[#eefbf7] text-[#28685c] transition hover:bg-[#dff8f0]"
                                aria-label="Save column name"
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingColumnId(null)}
                                className="grid h-9 w-9 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
                                aria-label="Cancel column edit"
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingColumnId(column.id);
                                  setColumnName(column.name);
                                }}
                                className="grid h-9 w-9 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
                                aria-label={`Rename ${column.name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setColumnToDelete(column)}
                                className="grid h-9 w-9 place-items-center rounded-md border border-[#f0c7c1] bg-[#fff5f2] text-[#944139] transition hover:bg-[#fee4df]"
                                aria-label={`Delete ${column.name}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => openCreateTask(column.id)}
                            className="ml-auto flex h-9 items-center gap-2 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-xs font-bold text-[#403c37] transition hover:border-[#ef594a] hover:text-[#ef594a]"
                          >
                            <Plus className="h-3.5 w-3.5 text-[#ef594a]" aria-hidden="true" />
                            Task
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3 overflow-y-auto p-3">
                        {column.tasks.length ? (
                          column.tasks.map((task) => (
                            <article
                              key={task.id}
                              draggable
                              onDragStart={(event) => handleDragStart(event, task.id)}
                              className="group cursor-grab rounded-lg border border-[#e8dfcf] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                              style={{ borderLeft: `5px solid ${selectedBoard.color}` }}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="mt-1 h-4 w-4 shrink-0 text-[#8a867d]" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="line-clamp-2 text-sm font-bold leading-5 text-[#292524]">
                                    {task.title}
                                  </h4>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span
                                      className={cn(
                                        "rounded-md border px-2 py-1 text-[11px] font-bold",
                                        priorityStyles[task.priority]
                                      )}
                                    >
                                      {task.priority}
                                    </span>
                                    <span className="flex items-center gap-1 rounded-md bg-[#fffaf0] px-2 py-1 text-[11px] font-bold text-[#6b675f]">
                                      <CalendarDays className="h-3 w-3 text-teal-600" aria-hidden="true" />
                                      {formatDueDate(task.dueDate)}
                                    </span>
                                  </div>
                                  {task.labels.length ? (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {task.labels.map((label) => (
                                        <span
                                          key={label.name}
                                          className="rounded px-2 py-1 text-[11px] font-bold text-white"
                                          style={{ backgroundColor: label.color }}
                                        >
                                          {label.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#6b675f]">
                                    {task.syncCalendar ? (
                                      <span className="flex items-center gap-1 rounded bg-[#eefbf7] px-2 py-1 text-[#28685c]">
                                        <CalendarDays className="h-3 w-3" aria-hidden="true" />
                                        Calendar
                                      </span>
                                    ) : null}
                                    {task.linkNotes ? (
                                      <span className="flex items-center gap-1 rounded bg-[#dff2fb] px-2 py-1 text-[#2f6b86]">
                                        <FileText className="h-3 w-3" aria-hidden="true" />
                                        Notes
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 flex justify-end gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                                <TaskCommentButton
                                  boardId={selectedBoard.id}
                                  task={task}
                                  onOpen={() => setCommentPanel({ boardId: selectedBoard.id, task })}
                                />
                                <button
                                  type="button"
                                  onClick={() => openEditTask(column.id, task)}
                                  className="grid h-8 w-8 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
                                  aria-label={`Edit ${task.title}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="grid h-8 w-8 place-items-center rounded-md border border-[#f0c7c1] bg-[#fff5f2] text-[#944139] transition hover:bg-[#fee4df]"
                                  aria-label={`Delete ${task.title}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCreateTask(column.id)}
                            className="w-full rounded-md border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-4 py-8 text-center transition hover:border-[#ef594a] hover:text-[#ef594a]"
                          >
                            <Plus className="mx-auto h-5 w-5 text-[#ef594a]" aria-hidden="true" />
                            <span className="mt-3 block text-sm font-bold text-[#6b675f]">Add the first task</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {commentPanel && commentPanel.boardId === selectedBoard.id ? (
                <TaskCommentsPanel state={commentPanel} onClose={() => setCommentPanel(null)} />
              ) : null}
            </KanbanLiveRoom>
          ) : (
            <div className="grid min-h-[560px] place-items-center bg-[#fffaf0] p-6 text-center">
              <div className="max-w-[360px]">
                <Columns3 className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
                <h2 className="mt-5 text-2xl font-bold text-[#292524]">Start with a board</h2>
                <p className="mt-3 text-base font-medium leading-7 text-[#6b675f]">
                  Your first board will arrive with Todo, In Progress, and Done columns ready to use.
                </p>
                <button
                  type="button"
                  onClick={openCreateBoardDialog}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create board
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {collaborationBoard ? (
        <CollaborationPanel board={collaborationBoard} onClose={() => setCollaborationBoard(null)} />
      ) : null}

      {boardDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111827]/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateBoard}
            className="my-6 w-full max-w-[500px] rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">
                  {editingBoardId ? "Edit Kanban board" : "Create Kanban board"}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#6b675f]">Choose a name and a color marker.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBoardDialogOpen(false);
                  setEditingBoardId(null);
                }}
                className="rounded-md px-3 py-2 text-sm font-bold text-[#403c37] transition hover:bg-[#fffaf0] hover:text-[#ef594a]"
              >
                Close
              </button>
            </div>

            <label className="mt-5 grid gap-2 text-sm font-bold text-[#403c37]">
              Board name
              <input
                required
                value={boardName}
                onChange={(event) => setBoardName(event.target.value)}
                className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                placeholder="Launch plan"
              />
            </label>

            <div className="mt-5 grid gap-2">
              <p className="text-sm font-bold text-[#403c37]">Board color</p>
              <div className="flex flex-wrap gap-3">
                {boardColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBoardColor(color)}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-md border border-[#e1d8c8] shadow-sm transition hover:-translate-y-0.5",
                      boardColor === color && "ring-2 ring-[#111827]/60"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Use ${color} board color`}
                  >
                    {boardColor === color ? <Check className="h-4 w-4 text-white" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setBoardDialogOpen(false);
                  setEditingBoardId(null);
                }}
                className="h-12 rounded-md border border-[#e1d8c8] bg-white px-5 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="h-12 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
              >
                {editingBoardId ? "Save board" : "Create board"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {boardToDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111827]/35 p-4 backdrop-blur-sm">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-board-title"
            aria-describedby="delete-board-description"
            className="my-6 w-full max-w-[460px] rounded-lg border border-[#f0c7c1] bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#fff0ed] text-[#944139]">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="delete-board-title" className="text-2xl font-bold text-[#111827]">
                  Delete board?
                </h2>
                <p id="delete-board-description" className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
                  This will permanently delete <span className="font-bold text-[#292524]">{boardToDelete.name}</span>{" "}
                  and all of its columns and tasks.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBoardToDelete(null)}
                className="h-12 rounded-md border border-[#e1d8c8] bg-white px-5 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDeleteBoard(boardToDelete.id)}
                className="h-12 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
              >
                Delete board
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {columnToDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111827]/35 p-4 backdrop-blur-sm">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-column-title"
            aria-describedby="delete-column-description"
            className="my-6 w-full max-w-[460px] rounded-lg border border-[#f0c7c1] bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#fff0ed] text-[#944139]">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="delete-column-title" className="text-2xl font-bold text-[#111827]">
                  Delete column?
                </h2>
                <p id="delete-column-description" className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
                  This will permanently delete{" "}
                  <span className="font-bold text-[#292524]">{columnToDelete.name}</span> and its{" "}
                  {columnToDelete.tasks.length} {columnToDelete.tasks.length === 1 ? "task" : "tasks"}.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setColumnToDelete(null)}
                className="h-12 rounded-md border border-[#e1d8c8] bg-white px-5 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDeleteColumn(columnToDelete.id)}
                className="h-12 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
              >
                Delete column
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {taskDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111827]/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleTaskSubmit}
            className="my-6 w-full max-w-[720px] rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">
                  {taskDialog.mode === "edit" ? "Edit task" : "Create task"}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#6b675f]">
                  Add the details that make this card easy to scan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaskDialog(null)}
                className="rounded-md px-3 py-2 text-sm font-bold text-[#403c37] transition hover:bg-[#fffaf0] hover:text-[#ef594a]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                Title
                <input
                  required
                  value={taskForm.title}
                  onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                  className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  placeholder="Write the next task"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                Description
                <textarea
                  value={taskForm.description}
                  onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-28 resize-none rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 py-3 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  placeholder="Add useful context"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-[#403c37] sm:col-span-2">
                  Column
                  <select
                    value={taskForm.columnId}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, columnId: Number(event.target.value) }))
                    }
                    className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  >
                    {selectedBoard?.columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                  Due date
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                    className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-[#403c37]">
                  Priority
                  <select
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, priority: event.target.value as KanbanPriority }))
                    }
                    className="h-12 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-2">
                <p className="flex items-center gap-2 text-sm font-bold text-[#403c37]">
                  <Tags className="h-4 w-4 text-[#8b5cf6]" aria-hidden="true" />
                  Labels
                </p>
                <div className="flex flex-wrap gap-3">
                  {labelOptions.map((label) => {
                    const selected = taskForm.labels.some((item) => item.name === label.name);

                    return (
                      <button
                        key={label.name}
                        type="button"
                        onClick={() => toggleLabel(label)}
                        className={cn(
                          "flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold shadow-sm transition",
                          selected ? "border-[#111827] bg-[#fffaf0]" : "border-[#e1d8c8] bg-white hover:border-[#ef594a]"
                        )}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-4 rounded-md border border-[#e1d8c8] bg-[#fffaf0] p-4 text-sm font-bold text-[#403c37]">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-teal-600" aria-hidden="true" />
                    Sync with Calendar
                  </span>
                  <input
                    type="checkbox"
                    checked={taskForm.syncCalendar}
                    onChange={(event) => setTaskForm((current) => ({ ...current, syncCalendar: event.target.checked }))}
                    className="h-5 w-5 accent-[#ef594a]"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 rounded-md border border-[#e1d8c8] bg-[#fffaf0] p-4 text-sm font-bold text-[#403c37]">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-600" aria-hidden="true" />
                    Link with Notes
                  </span>
                  <input
                    type="checkbox"
                    checked={taskForm.linkNotes}
                    onChange={(event) => setTaskForm((current) => ({ ...current, linkNotes: event.target.checked }))}
                    className="h-5 w-5 accent-[#ef594a]"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setTaskDialog(null)}
                className="h-12 rounded-md border border-[#e1d8c8] bg-white px-6 text-base font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="h-12 rounded-md bg-[#ef594a] px-6 text-base font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
              >
                {taskDialog.mode === "edit" ? "Save changes" : "Create task"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
