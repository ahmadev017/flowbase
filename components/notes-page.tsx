"use client";

import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Lightbulb,
  LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Mic,
  MoreHorizontal,
  PenLine,
  Pilcrow,
  Pin,
  Plus,
  Quote,
  Redo2,
  Search,
  Sparkles,
  Square,
  Strikethrough,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  NoteDTO,
  RefineOperation,
  RefineTone,
  createNote,
  deleteNote,
  duplicateNote,
  permanentlyDeleteNote,
  refineSelectedText,
  restoreNote,
  updateNote,
} from "@/app/notes/actions";
import { useAssemblyAIStreaming } from "@/lib/use-assemblyai-streaming";
import { cn } from "@/lib/utils";

const noteColors = ["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259"];
const noteIconOptions = [
  { name: "FileText", icon: FileText },
  { name: "BookOpen", icon: BookOpen },
  { name: "Lightbulb", icon: Lightbulb },
  { name: "Sparkles", icon: Sparkles },
  { name: "PenLine", icon: PenLine },
];
const refineOperations: RefineOperation[] = [
  "Improve grammar",
  "Rephrase",
  "Make shorter",
  "Make longer",
  "Simplify language",
  "Change tone",
];
const tones: RefineTone[] = ["friendly", "professional", "confident", "casual"];

type SaveStatus = "Saved" | "Saving..." | "Unsaved" | "Save failed";
type SlashCommand = {
  label: string;
  hint: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  run: () => void;
};

const TextSize = Mark.create({
  name: "textSize",

  addAttributes() {
    return {
      level: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-text-size"),
        renderHTML: (attributes) => {
          if (!attributes.level) {
            return {};
          }

          return {
            "data-text-size": attributes.level,
            class: `text-size-${attributes.level}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-text-size]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

function formatRelativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(delta / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function textFromNote(note: NoteDTO) {
  const stack = Array.isArray(note.content.content) ? [...note.content.content] : [];
  const parts: string[] = [];

  while (stack.length) {
    const node = stack.shift() as { text?: string; content?: unknown[] };
    if (node.text) {
      parts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      stack.push(...node.content);
    }
  }

  return parts.join(" ");
}

function ToolbarButton({
  active,
  label,
  onBeforeAction,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onBeforeAction?: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        onBeforeAction?.();
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        onBeforeAction?.();
      }}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md border text-[#5f5b55] transition",
        active
          ? "border-[#f0c7c1] bg-[#fee4df] text-[#c94d42]"
          : "border-transparent bg-white hover:border-[#e1d8c8] hover:text-[#ef594a]"
      )}
    >
      {children}
    </button>
  );
}

export function NotesPage({
  initialNotes,
  authError,
}: {
  initialNotes: NoteDTO[];
  authError?: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState(initialNotes.find((note) => !note.deletedAt)?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openNoteMenuId, setOpenNoteMenuId] = useState<number | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [message, setMessage] = useState(authError ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [refineOpen, setRefineOpen] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const [slashMenu, setSlashMenu] = useState({ open: false, left: 0, top: 0, query: "" });
  const [editorText, setEditorText] = useState("");
  const [isPending, startTransition] = useTransition();
  const syncingEditorRef = useRef(false);
  const loadedNoteIdRef = useRef<number | null>(null);
  const editVersionRef = useRef(0);
  const toolbarSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const streamingDraftRangeRef = useRef<{ from: number; to: number } | null>(null);
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId && !note.deletedAt) ?? null,
    [notes, selectedNoteId]
  );
  const activeNotes = useMemo(
    () =>
      notes
        .filter((note) => !note.deletedAt)
        .filter((note) => {
          const query = searchQuery.trim().toLowerCase();
          return !query || note.title.toLowerCase().includes(query) || textFromNote(note).toLowerCase().includes(query);
        })
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) {
            return a.isPinned ? -1 : 1;
          }
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    [notes, searchQuery]
  );
  const trashedNotes = useMemo(
    () => notes.filter((note) => note.deletedAt).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [notes]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextSize,
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({
        autolink: true,
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[#2d9cdb] underline underline-offset-2",
        },
      }),
      TaskList.configure({
        HTMLAttributes: { class: "notion-task-list" },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "notion-task-item" },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "heading" ? "Untitled heading" : "Press / for commands"),
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none focus:outline-none min-h-[520px] px-2 py-5 text-[17px] leading-8 text-[#292524]",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setEditorText(currentEditor.getText());

      if (syncingEditorRef.current) {
        return;
      }

      editVersionRef.current += 1;
      updateSlashMenu(currentEditor);
      setSaveStatus("Unsaved");
    },
  });

  function captureToolbarSelection() {
    if (!editor) {
      return;
    }

    const { from, to, empty } = editor.state.selection;
    toolbarSelectionRef.current = empty ? null : { from, to };
  }

  function getToolbarSelection() {
    if (!editor) {
      return { from: 0, to: 0, empty: true };
    }

    const { from, to, empty } = editor.state.selection;
    const saved = toolbarSelectionRef.current;

    if (!empty) {
      return { from, to, empty: false };
    }

    if (saved && saved.from < saved.to && saved.to <= editor.state.doc.content.size) {
      return { ...saved, empty: false };
    }

    return { from, to, empty: true };
  }

  function replaceNote(nextNote: NoteDTO) {
    setNotes((current) => current.map((note) => (note.id === nextNote.id ? nextNote : note)));
  }

  const insertTranscriptIntoEditor = useCallback(
    (transcript: string, mode: "partial" | "final" = "final") => {
      if (!editor) {
        return;
      }

      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) {
        return;
      }

      const draftRange = streamingDraftRangeRef.current;
      const validDraftRange = draftRange && draftRange.to <= editor.state.doc.content.size ? draftRange : null;
      const selection = editor.state.selection;
      const hasCursor = editor.view.hasFocus() && selection.empty;
      const insertAt = validDraftRange ? validDraftRange.from : hasCursor ? selection.from : editor.state.doc.content.size;
      const previousCharacter = insertAt > 1 ? editor.state.doc.textBetween(insertAt - 1, insertAt, "\n", "\n") : "";
      const nextPosition = validDraftRange ? validDraftRange.to : insertAt;
      const nextCharacter =
        nextPosition < editor.state.doc.content.size ? editor.state.doc.textBetween(nextPosition, nextPosition + 1, "\n", "\n") : "";
      const leadingSpace = previousCharacter && !/\s/.test(previousCharacter) ? " " : "";
      const trailingSpace = nextCharacter && !/\s/.test(nextCharacter) ? " " : "";
      const insertedText = `${leadingSpace}${trimmedTranscript}${trailingSpace || " "}`;

      editor
        .chain()
        .focus()
        .insertContentAt(validDraftRange ? validDraftRange : insertAt, insertedText)
        .run();

      if (mode === "partial") {
        streamingDraftRangeRef.current = {
          from: insertAt,
          to: insertAt + insertedText.length,
        };
      } else {
        streamingDraftRangeRef.current = null;
      }

      setEditorText(editor.getText());
      editVersionRef.current += 1;
      setSaveStatus("Unsaved");
    },
    [editor]
  );

  const {
    error: streamingError,
    isRecording,
    isStarting,
    isStopping,
    livePreview,
    start: startStreaming,
    stop: stopStreaming,
  } = useAssemblyAIStreaming({
    onFinalTranscript: (transcript) => insertTranscriptIntoEditor(transcript, "final"),
    onPartialTranscript: (transcript) => insertTranscriptIntoEditor(transcript, "partial"),
  });

  useEffect(() => {
    if (!isRecording && !isStarting) {
      streamingDraftRangeRef.current = null;
    }
  }, [isRecording, isStarting]);

  function getNoteIcon(iconName: string) {
    return noteIconOptions.find((item) => item.name === iconName)?.icon ?? FileText;
  }

  function updateSlashMenu(currentEditor = editor) {
    if (!currentEditor) {
      return;
    }

    const { selection } = currentEditor.state;
    const from = selection.from;
    const parentOffset = selection.$from.parentOffset;
    const textBefore = selection.$from.parent.textBetween(0, parentOffset, "\n", "\n");
    const match = /(?:^|\s)\/([\w ]{0,24})$/.exec(textBefore);

    if (!selection.empty || !match) {
      setSlashMenu((current) => (current.open ? { ...current, open: false } : current));
      return;
    }

    const coords = currentEditor.view.coordsAtPos(from);
    setSlashMenu({
      open: true,
      left: coords.left,
      top: coords.bottom + 8,
      query: match[1].trim().toLowerCase(),
    });
  }

  function applySlashCommand(run: () => void) {
    if (!editor) {
      return;
    }

    const { selection } = editor.state;
    const deleteFrom = Math.max(selection.from - slashMenu.query.length - 1, 0);
    editor.chain().focus().deleteRange({ from: deleteFrom, to: selection.from }).run();
    run();
    setSlashMenu((current) => ({ ...current, open: false }));
  }

  function applyHeading(level: 1 | 2) {
    if (!editor) {
      return;
    }

    const selection = getToolbarSelection();
    const hasSelection = !selection.empty;
    const textSizeMark = editor.schema.marks.textSize;

    if (!hasSelection) {
      editor.chain().focus().toggleHeading({ level }).run();
      return;
    }

    if (!textSizeMark) {
      const selectedText = editor.state.doc.textBetween(selection.from, selection.to, "\n");

      editor
        .chain()
        .focus()
        .setTextSelection({ from: selection.from, to: selection.to })
        .insertContent({
          type: "text",
          text: selectedText,
          marks: [{ type: "bold" }],
        })
        .run();
      return;
    }

    const chain = editor.chain().focus().setTextSelection({ from: selection.from, to: selection.to });

    if (editor.isActive("heading")) {
      chain.setParagraph();
    }

    if (editor.isActive("textSize", { level: String(level) })) {
      chain.unsetMark("textSize").run();
      return;
    }

    chain.setMark("textSize", { level: String(level) }).run();
    toolbarSelectionRef.current = null;
  }

  function isTextSizeActive(level: 1 | 2) {
    return Boolean(editor?.schema.marks.textSize && editor.isActive("textSize", { level: String(level) }));
  }

  function applyList(type: "bulletList" | "orderedList" | "taskList") {
    if (!editor) {
      return;
    }

    const { from, to, empty } = getToolbarSelection();

    if (empty) {
      const chain = editor.chain().focus();

      if (type === "bulletList") {
        chain.toggleBulletList().run();
        return;
      }

      if (type === "orderedList") {
        chain.toggleOrderedList().run();
        return;
      }

      chain.toggleTaskList().run();
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, "\n", "\n");
    const lines = selectedText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return;
    }

    const listContent =
      type === "taskList"
        ? {
            type: "taskList",
            content: lines.map((line) => ({
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: line }] }],
            })),
          }
        : {
            type,
            content: lines.map((line) => ({
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: line }] }],
            })),
          };

    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .insertContentAt({ from, to }, listContent, { updateSelection: true })
      .run();
    toolbarSelectionRef.current = null;
  }

  const slashCommands: SlashCommand[] = editor
    ? [
        {
          label: "Paragraph",
          hint: "Plain text block",
          icon: Pilcrow,
          run: () => editor.chain().focus().setParagraph().run(),
        },
        {
          label: "Heading 1",
          hint: "Large section title",
          icon: Heading1,
          run: () => applyHeading(1),
        },
        {
          label: "Heading 2",
          hint: "Medium section title",
          icon: Heading2,
          run: () => applyHeading(2),
        },
        {
          label: "Bullet list",
          hint: "Simple unordered list",
          icon: List,
          run: () => applyList("bulletList"),
        },
        {
          label: "Numbered list",
          hint: "Ordered steps",
          icon: ListOrdered,
          run: () => applyList("orderedList"),
        },
        {
          label: "Checklist",
          hint: "To-do items",
          icon: ListChecks,
          run: () => applyList("taskList"),
        },
        {
          label: "Quote",
          hint: "Highlighted thought",
          icon: Quote,
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: "Divider",
          hint: "Horizontal rule",
          icon: Type,
          run: () => editor.chain().focus().setHorizontalRule().run(),
        },
      ]
    : [];
  const visibleSlashCommands = slashCommands.filter((item) => item.label.toLowerCase().includes(slashMenu.query));

  useEffect(() => {
    if (!selectedNote || !editor) {
      setTitleDraft("");
      loadedNoteIdRef.current = null;
      return;
    }

    if (loadedNoteIdRef.current === selectedNote.id) {
      return;
    }

    loadedNoteIdRef.current = selectedNote.id;
    setTitleDraft(selectedNote.title);
    syncingEditorRef.current = true;
    editor.commands.setContent(selectedNote.content);
    setEditorText(editor.getText());
    setSaveStatus("Saved");
    editVersionRef.current = 0;
    queueMicrotask(() => {
      syncingEditorRef.current = false;
    });
  }, [editor, selectedNote, selectedNoteId]);

  useEffect(() => {
    if (streamingError) {
      setMessage(streamingError);
    }
  }, [streamingError]);

  useEffect(() => {
    if (!editor || !selectedNote || saveStatus !== "Unsaved") {
      return;
    }

    const handle = window.setTimeout(() => {
      const noteId = selectedNote.id;
      const content = editor.getJSON();
      const title = titleDraft;
      const saveVersion = editVersionRef.current;

      setSaveStatus("Saving...");
      startTransition(async () => {
        try {
          const updated = await updateNote(noteId, { title, content });
          replaceNote(updated);
          if (loadedNoteIdRef.current === noteId && editVersionRef.current === saveVersion) {
            setSaveStatus("Saved");
          }
        } catch (error) {
          setSaveStatus("Save failed");
          setMessage(error instanceof Error ? error.message : "Unable to save note.");
        }
      });
    }, 700);

    return () => window.clearTimeout(handle);
  }, [editor, saveStatus, selectedNote, titleDraft]);

  function handleCreateNote() {
    startTransition(async () => {
      setMessage("");
      try {
        const note = await createNote({ title: "Untitled note", color: noteColors[notes.length % noteColors.length] });
        setNotes((current) => [note, ...current]);
        setSelectedNoteId(note.id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create note.");
      }
    });
  }

  function handleRename(note: NoteDTO) {
    const nextTitle = window.prompt("Rename note", note.title);
    if (nextTitle === null) {
      return;
    }

    startTransition(async () => {
      try {
        const updated = await updateNote(note.id, { title: nextTitle });
        replaceNote(updated);
        if (selectedNoteId === note.id) {
          setTitleDraft(updated.title);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to rename note.");
      }
    });
  }

  function handleDuplicate(note: NoteDTO) {
    startTransition(async () => {
      try {
        const copy = await duplicateNote(note.id);
        setNotes((current) => [copy, ...current]);
        setSelectedNoteId(copy.id);
        setOpenNoteMenuId(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to duplicate note.");
      }
    });
  }

  function handleSoftDelete(note: NoteDTO) {
    startTransition(async () => {
      try {
        const deleted = await deleteNote(note.id);
        replaceNote(deleted);
        setTrashOpen(true);
        if (selectedNoteId === note.id) {
          const nextNote = activeNotes.find((item) => item.id !== note.id) ?? null;
          setSelectedNoteId(nextNote?.id ?? null);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete note.");
      }
    });
  }

  function handleRestore(note: NoteDTO) {
    startTransition(async () => {
      try {
        const restored = await restoreNote(note.id);
        replaceNote(restored);
        setSelectedNoteId(restored.id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to restore note.");
      }
    });
  }

  function handlePermanentDelete(note: NoteDTO) {
    startTransition(async () => {
      try {
        await permanentlyDeleteNote(note.id);
        setNotes((current) => current.filter((item) => item.id !== note.id));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to permanently delete note.");
      }
    });
  }

  function handleUpdateColor(note: NoteDTO, color: string) {
    startTransition(async () => {
      try {
        const updated = await updateNote(note.id, { color });
        replaceNote(updated);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update note color.");
      }
    });
  }

  function handleUpdateIcon(note: NoteDTO, icon: string) {
    startTransition(async () => {
      try {
        const updated = await updateNote(note.id, { icon });
        replaceNote(updated);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update note icon.");
      }
    });
  }

  function handleTogglePin(note: NoteDTO) {
    startTransition(async () => {
      try {
        const updated = await updateNote(note.id, { isPinned: !note.isPinned });
        replaceNote(updated);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update pin.");
      }
    });
  }

  function handleTitleChange(value: string) {
    setTitleDraft(value);
    editVersionRef.current += 1;
    setSaveStatus("Unsaved");
  }

  function handleSetLink() {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Link URL", previousUrl || "https://");

    if (url === null) {
      return;
    }

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function handleRefine(operation: RefineOperation, tone?: RefineTone) {
    if (!editor) {
      return;
    }

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, "\n");

    startTransition(async () => {
      setMessage("");
      try {
        const refined = await refineSelectedText({ text: selectedText, operation, tone });
        editor.chain().focus().insertContent(refined).run();
        setRefineOpen(false);
        setToneOpen(false);
        setSaveStatus("Unsaved");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to refine text.");
      }
    });
  }

  return (
    <div className="min-w-0">
      <header className="border-b border-[#e1d8c8] pb-6">
        <p className="flex items-center gap-2 text-sm font-bold text-[#d85749]">
          <FileText className="h-4 w-4 text-sky-600" aria-hidden="true" />
          Notes
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#111827] lg:text-4xl">
          Draft, refine, and keep your thoughts close.
        </h1>
      </header>

      {message ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[#f0c7c1] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#944139]">
          <span className="min-w-0">{message}</span>
          <button type="button" onClick={() => setMessage("")} className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-white">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="mt-6 grid h-[calc(100vh-210px)] min-h-[520px] min-w-0 overflow-hidden rounded-lg border border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-[#e8dfcf] bg-[#fffaf0] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#e8dfcf] p-4">
            <div className="flex gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-3 text-sm font-semibold text-[#6b675f] shadow-sm">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9d978d]"
                placeholder="Search notes"
              />
            </label>
            <button
              type="button"
              disabled={isPending}
              onClick={handleCreateNote}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#ef594a] text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
              aria-label="New Note"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
            {activeNotes.length ? (
              <div className="min-w-0 space-y-2">
                {activeNotes.map((note) => (
                  <div key={note.id} className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedNoteId(note.id)}
                      className={cn(
                        "group w-full rounded-md border p-3 pr-20 text-left transition",
                        selectedNoteId === note.id
                          ? "border-[#85d8e9] bg-[#e1f6fd] shadow-sm"
                          : "border-transparent bg-transparent hover:border-[#e1d8c8] hover:bg-white"
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/80 text-[#344154] shadow-sm">
                          {(() => {
                            const NoteIcon = getNoteIcon(note.icon);
                            return <NoteIcon className="h-4 w-4" aria-hidden="true" />;
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-bold text-[#292524]">{note.title}</p>
                            {note.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 fill-[#ef594a] text-[#ef594a]" aria-hidden="true" /> : null}
                          </div>
                          <div className="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-[#77736b]">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: note.color }} />
                            <span>{formatRelativeTime(note.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(note)}
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-md transition",
                          note.isPinned ? "bg-[#fff7dd] text-[#d68a21]" : "text-[#9d978d] hover:bg-[#fff7dd] hover:text-[#d68a21]"
                        )}
                        aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                      >
                        <Pin className={cn("h-4 w-4", note.isPinned && "fill-current")} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenNoteMenuId(openNoteMenuId === note.id ? null : note.id)}
                        className="grid h-8 w-8 place-items-center rounded-md text-[#9d978d] transition hover:bg-white hover:text-[#ef594a]"
                        aria-label="Open note actions"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {openNoteMenuId === note.id ? (
                      <div className="absolute right-2 top-11 z-30 w-[232px] rounded-md border border-[#e1d8c8] bg-white p-2 text-sm font-bold text-[#403c37] shadow-xl">
                        <p className="px-2 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#8a867d]">Color</p>
                        <div className="grid grid-cols-6 gap-2 px-1">
                          {noteColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => handleUpdateColor(note, color)}
                              className={cn(
                                "grid h-9 w-9 place-items-center rounded-md border bg-white shadow-sm transition hover:-translate-y-0.5",
                                note.color === color ? "border-[#111827] ring-2 ring-[#85d8e9]" : "border-[#e1d8c8]"
                              )}
                              aria-label={`Use ${color}`}
                            >
                              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
                            </button>
                          ))}
                        </div>

                        <p className="px-2 pb-2 pt-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#8a867d]">Icon</p>
                        <div className="grid grid-cols-5 gap-2 px-1">
                          {noteIconOptions.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.name}
                                type="button"
                                onClick={() => handleUpdateIcon(note, item.name)}
                                className={cn(
                                  "grid h-9 w-9 place-items-center rounded-md border bg-white text-[#6b675f] shadow-sm transition hover:border-[#85d8e9] hover:text-[#111827]",
                                  note.icon === item.name && "border-[#111827] text-[#111827] ring-2 ring-[#85d8e9]"
                                )}
                                aria-label={`Use ${item.name} icon`}
                              >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </button>
                            );
                          })}
                        </div>

                        <div className="my-2 h-px bg-[#e8dfcf]" />
                        <button type="button" onClick={() => handleDuplicate(note)} className="flex h-10 w-full items-center gap-2 rounded px-2 hover:bg-[#fffaf0]">
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenNoteMenuId(null);
                            handleSoftDelete(note);
                          }}
                          className="mt-1 flex h-10 w-full items-center gap-2 rounded bg-[#fff0f1] px-2 text-[#d85749] hover:bg-[#fee4df]"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Move to Trash
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[#d8cdbb] bg-white px-5 py-10 text-center">
                <FileText className="mx-auto h-7 w-7 text-sky-600" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-[#292524]">No notes found</p>
              </div>
            )}
          </div>

          <div className="border-t border-[#e8dfcf] p-3">
            <button
              type="button"
              onClick={() => setTrashOpen((value) => !value)}
              className="flex h-10 w-full items-center justify-between rounded-md px-2 text-sm font-bold text-[#6b675f] transition hover:bg-white hover:text-[#ef594a]"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Trash
              </span>
              <span className="rounded bg-white px-2 py-1 text-xs">{trashedNotes.length}</span>
            </button>
            {trashOpen ? (
              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                {trashedNotes.length ? (
                  trashedNotes.map((note) => (
                    <div key={note.id} className="rounded-md border border-[#e1d8c8] bg-white p-2">
                      <p className="truncate text-sm font-bold text-[#292524]">{note.title}</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => handleRestore(note)} className="h-8 rounded-md border border-[#e1d8c8] px-2 text-xs font-bold text-[#386f61]">
                          Restore
                        </button>
                        <button type="button" onClick={() => handlePermanentDelete(note)} className="h-8 rounded-md border border-[#f0c7c1] px-2 text-xs font-bold text-[#944139]">
                          Delete forever
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="px-2 py-4 text-center text-xs font-semibold text-[#8a867d]">Trash is empty</p>
                )}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="min-h-0 min-w-0 overflow-hidden bg-white">
          {selectedNote && editor ? (
            <div className="flex h-full min-h-0 min-w-0 flex-col">
              <div className="sticky top-0 z-10 border-b border-[#e8dfcf] bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: selectedNote.color }} />
                    <input
                      value={titleDraft}
                      onChange={(event) => handleTitleChange(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-2xl font-bold tracking-tight text-[#111827] outline-none placeholder:text-[#b8afa2]"
                      placeholder="Untitled note"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#77736b]">
                    <span className={cn(saveStatus === "Save failed" && "text-[#944139]", saveStatus === "Saving..." && "text-[#2f6b86]")}>
                      {saveStatus}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-[#c6baaa]" />
                    <span>{wordCount(editorText)} words</span>
                  </div>
                </div>

                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1 rounded-md border border-[#e1d8c8] bg-[#fffaf0] p-1">
                  <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                    <UnderlineIcon className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
                    <Strikethrough className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton
                    label="Heading 1"
                    active={editor.isActive("heading", { level: 1 }) || isTextSizeActive(1)}
                    onBeforeAction={captureToolbarSelection}
                    onClick={() => applyHeading(1)}
                  >
                    <Heading1 className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton
                    label="Heading 2"
                    active={editor.isActive("heading", { level: 2 }) || isTextSizeActive(2)}
                    onBeforeAction={captureToolbarSelection}
                    onClick={() => applyHeading(2)}
                  >
                    <Heading2 className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton
                    label="Bullet list"
                    active={editor.isActive("bulletList")}
                    onBeforeAction={captureToolbarSelection}
                    onClick={() => applyList("bulletList")}
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton
                    label="Numbered list"
                    active={editor.isActive("orderedList")}
                    onBeforeAction={captureToolbarSelection}
                    onClick={() => applyList("orderedList")}
                  >
                    <ListOrdered className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton
                    label="Checklist"
                    active={editor.isActive("taskList")}
                    onBeforeAction={captureToolbarSelection}
                    onClick={() => applyList("taskList")}
                  >
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                    <Quote className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
                    <Highlighter className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Link" active={editor.isActive("link")} onClick={handleSetLink}>
                    <LinkIcon className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
                    <Redo2 className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <button
                    type="button"
                    onPointerDown={(event) => event.preventDefault()}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={isRecording || isStarting ? stopStreaming : startStreaming}
                    disabled={isStopping}
                    className={cn(
                      "ml-1 flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                      isRecording || isStarting
                        ? "border-[#f0c7c1] bg-[#fee4df] text-[#c94d42] hover:bg-[#fdd8d0]"
                        : "border-[#e1d8c8] bg-white text-[#5f5b55] hover:border-[#f0c7c1] hover:text-[#ef594a]"
                    )}
                  >
                    {isRecording || isStarting ? (
                      <>
                        <span className="relative grid h-4 w-4 place-items-center">
                          <span className="absolute h-4 w-4 animate-ping rounded-full bg-[#ef594a]/30" />
                          <Mic className="relative h-4 w-4" aria-hidden="true" />
                        </span>
                        {isStarting ? "Connecting..." : "Stop Recording"}
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" aria-hidden="true" />
                        Speak to Note
                      </>
                    )}
                  </button>
                </div>

                {livePreview ? (
                  <div className="mt-3 rounded-md border border-[#d7ecf5] bg-[#f5fbff] px-3 py-2 text-sm text-[#2f586b] shadow-sm">
                    <div className="flex items-start gap-2">
                      <Mic className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-[#2d9cdb]" aria-hidden="true" />
                      <p className="min-w-0 flex-1">
                        <span className="font-bold">Listening:</span> {livePreview}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-4xl">
                  <EditorContent editor={editor} className="notion-editor" />
                </div>

                <BubbleMenu
                  editor={editor}
                  shouldShow={({ editor: currentEditor }) => !currentEditor.state.selection.empty}
                  className="flex items-center gap-1 rounded-md border border-[#e1d8c8] bg-white p-1 shadow-xl"
                >
                  <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <ToolbarButton label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
                    <Highlighter className="h-4 w-4" aria-hidden="true" />
                  </ToolbarButton>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRefineOpen((value) => !value)}
                      className="flex h-9 items-center gap-2 rounded-md bg-[#ef594a] px-3 text-xs font-bold text-white transition hover:bg-[#dc4d40]"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      AI Refine
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    {refineOpen ? (
                      <div className="absolute left-0 top-11 z-30 w-48 rounded-md border border-[#e1d8c8] bg-white p-1 text-sm font-bold text-[#403c37] shadow-xl">
                        {refineOperations.map((operation) =>
                          operation === "Change tone" ? (
                            <div key={operation} className="relative">
                              <button
                                type="button"
                                onClick={() => setToneOpen((value) => !value)}
                                className="flex h-9 w-full items-center justify-between rounded px-2 hover:bg-[#fffaf0]"
                              >
                                Change tone
                                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              {toneOpen ? (
                                <div className="absolute left-full top-0 ml-2 w-36 rounded-md border border-[#e1d8c8] bg-white p-1 shadow-xl">
                                  {tones.map((tone) => (
                                    <button
                                      key={tone}
                                      type="button"
                                      onClick={() => handleRefine("Change tone", tone)}
                                      className="h-8 w-full rounded px-2 text-left capitalize hover:bg-[#fffaf0]"
                                    >
                                      {tone}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <button
                              key={operation}
                              type="button"
                              onClick={() => handleRefine(operation)}
                              className="h-9 w-full rounded px-2 text-left hover:bg-[#fffaf0]"
                            >
                              {operation}
                            </button>
                          )
                        )}
                      </div>
                    ) : null}
                  </div>
                </BubbleMenu>

                {slashMenu.open && visibleSlashCommands.length ? (
                  <div
                    className="fixed z-30 w-72 rounded-lg border border-[#e1d8c8] bg-white p-2 shadow-xl"
                    style={{ left: slashMenu.left, top: slashMenu.top }}
                  >
                    {visibleSlashCommands.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => applySlashCommand(item.run)}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-[#fffaf0]"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#fffaf0] text-[#ef594a]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-[#292524]">{item.label}</span>
                            <span className="block truncate text-xs font-semibold text-[#77736b]">{item.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-[520px] place-items-center p-6 text-center">
              <div className="max-w-[360px]">
                <FileText className="mx-auto h-11 w-11 text-sky-600" aria-hidden="true" />
                <h2 className="mt-5 text-2xl font-bold text-[#292524]">Choose a note</h2>
                <p className="mt-3 text-base font-medium leading-7 text-[#6b675f]">
                  Select a note from the left panel or create a new one to start writing.
                </p>
                <button
                  type="button"
                  onClick={handleCreateNote}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Note
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
