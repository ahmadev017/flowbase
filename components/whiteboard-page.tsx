"use client";

import dynamic from "next/dynamic";
import {
  Bot,
  Check,
  Download,
  FileImage,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  GeneratedDiagram,
  WhiteboardDTO,
  createWhiteboard,
  deleteWhiteboard,
  generateWhiteboardDiagram,
  renameWhiteboard,
  updateWhiteboard,
} from "@/app/whiteboard/actions";
import { cn } from "@/lib/utils";

import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[520px] place-items-center bg-white text-sm font-bold text-[#6b675f]">
      Loading whiteboard...
    </div>
  ),
});

type SaveStatus = "Saved" | "Saving..." | "Unsaved" | "Save failed";
type ColorTarget = "stroke" | "background" | "text" | "sticky";

const boardColors = ["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259"];
const strokeColors = ["#111827", "#ef594a", "#2f7f72", "#8a6321", "#5b3db8", "#2d6f91"];
const backgroundColors = ["transparent", "#fff0bd", "#fee4df", "#dff8f3", "#ece5ff", "#e8f4ff"];
const stickyColors = ["#fff0bd", "#fee4df", "#dff8f3", "#ece5ff", "#e8f4ff", "#f4e8cf"];

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

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "whiteboard";
}

function sanitizeAppState(appState: Partial<AppState> | Record<string, unknown>) {
  const state = appState as Partial<AppState>;
  return {
    viewBackgroundColor: state.viewBackgroundColor ?? "#fffaf0",
    currentItemStrokeColor: state.currentItemStrokeColor ?? "#111827",
    currentItemBackgroundColor: state.currentItemBackgroundColor ?? "transparent",
    currentItemFillStyle: state.currentItemFillStyle ?? "solid",
    currentItemStrokeWidth: state.currentItemStrokeWidth ?? 2,
    currentItemFontSize: state.currentItemFontSize ?? 20,
    gridSize: state.gridSize ?? null,
  };
}

function sceneSignature(
  elements: readonly ExcalidrawElement[] | unknown[],
  appState: Record<string, unknown>,
  files: BinaryFiles | Record<string, unknown>
) {
  return JSON.stringify({
    elements,
    appState: sanitizeAppState(appState),
    files,
  });
}

function buildDiagramSkeleton(diagram: GeneratedDiagram, originX: number, originY: number) {
  const nodes = diagram.nodes;
  const nodePositions = new Map<string, { x: number; y: number }>();
  const skeleton: Array<Record<string, unknown>> = [
    {
      type: "text",
      x: originX,
      y: originY - 66,
      text: diagram.title,
      fontSize: 28,
      strokeColor: "#111827",
    },
  ];

  if (diagram.type === "mind_map") {
    nodePositions.set(nodes[0].id, { x: originX + 360, y: originY + 140 });
    nodes.slice(1).forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length - 1);
      nodePositions.set(node.id, {
        x: originX + 360 + Math.cos(angle) * 300,
        y: originY + 140 + Math.sin(angle) * 190,
      });
    });
  } else if (diagram.type === "system_architecture") {
    nodes.forEach((node, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      nodePositions.set(node.id, { x: originX + column * 260, y: originY + row * 180 });
    });
  } else {
    nodes.forEach((node, index) => {
      nodePositions.set(node.id, { x: originX + index * 250, y: originY + (index % 2) * 90 });
    });
  }

  nodes.forEach((node, index) => {
    const position = nodePositions.get(node.id) ?? { x: originX, y: originY };
    const palette = stickyColors[index % stickyColors.length];
    skeleton.push({
      type: diagram.type === "mind_map" && index === 0 ? "ellipse" : "rectangle",
      x: position.x,
      y: position.y,
      width: 190,
      height: node.detail ? 104 : 82,
      strokeColor: "#3f3a34",
      backgroundColor: palette,
      fillStyle: "solid",
      roughness: 1,
      label: {
        text: node.detail ? `${node.label}\n${node.detail}` : node.label,
        fontSize: 18,
        strokeColor: "#292524",
      },
    });
  });

  diagram.edges.forEach((edge) => {
    const from = nodePositions.get(edge.from);
    const to = nodePositions.get(edge.to);

    if (!from || !to) {
      return;
    }

    skeleton.push({
      type: "arrow",
      x: from.x + 190,
      y: from.y + 42,
      width: to.x - from.x - 190,
      height: to.y - from.y,
      strokeColor: "#5f5b55",
      endArrowhead: "arrow",
      label: edge.label
        ? {
            text: edge.label,
            fontSize: 14,
            strokeColor: "#5f5b55",
          }
        : undefined,
    });
  });

  return skeleton;
}

function ColorButton({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-white shadow-sm transition hover:-translate-y-0.5",
        selected ? "border-[#111827] ring-2 ring-[#85d8e9]" : "border-[#e1d8c8]"
      )}
      aria-label={`Use ${color}`}
      title={color}
    >
      <span
        className="h-5 w-5 rounded"
        style={{
          backgroundColor: color === "transparent" ? "white" : color,
          backgroundImage:
            color === "transparent"
              ? "linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)"
              : undefined,
          backgroundSize: color === "transparent" ? "8px 8px" : undefined,
          backgroundPosition: color === "transparent" ? "0 0,0 4px,4px -4px,-4px 0" : undefined,
        }}
      />
    </button>
  );
}

export function WhiteboardPage({
  initialWhiteboards,
  authError,
}: {
  initialWhiteboards: WhiteboardDTO[];
  authError?: string;
}) {
  const [whiteboards, setWhiteboards] = useState(initialWhiteboards);
  const [selectedWhiteboardId, setSelectedWhiteboardId] = useState(initialWhiteboards[0]?.id ?? null);
  const [message, setMessage] = useState(authError ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [titleDraft, setTitleDraft] = useState("");
  const [boardMenuId, setBoardMenuId] = useState<number | null>(null);
  const [colorTarget, setColorTarget] = useState<ColorTarget>("stroke");
  const [stickyColor, setStickyColor] = useState(stickyColors[0]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const elementsRef = useRef<readonly ExcalidrawElement[]>([]);
  const appStateRef = useRef<Record<string, unknown>>({});
  const filesRef = useRef<BinaryFiles>({});
  const loadingSceneRef = useRef(false);
  const saveVersionRef = useRef(0);
  const lastSavedSignatureRef = useRef("");

  const selectedWhiteboard = useMemo(
    () => whiteboards.find((board) => board.id === selectedWhiteboardId) ?? whiteboards[0] ?? null,
    [selectedWhiteboardId, whiteboards]
  );

  const currentElements = elementsRef.current.filter((element) => !element.isDeleted);
  const canExport = currentElements.length > 0;

  function replaceWhiteboard(nextBoard: WhiteboardDTO) {
    setWhiteboards((current) => current.map((board) => (board.id === nextBoard.id ? nextBoard : board)));
  }

  function handleCreateWhiteboard() {
    startTransition(async () => {
      setMessage("");
      try {
        const board = await createWhiteboard({
          name: `Whiteboard ${whiteboards.length + 1}`,
          color: boardColors[whiteboards.length % boardColors.length],
        });
        setWhiteboards((current) => [board, ...current]);
        setSelectedWhiteboardId(board.id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create whiteboard.");
      }
    });
  }

  function handleRename(board: WhiteboardDTO) {
    const nextName = window.prompt("Rename whiteboard", board.name);
    if (nextName === null) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const updated = await renameWhiteboard(board.id, { name: nextName, color: board.color });
        replaceWhiteboard(updated);
        if (selectedWhiteboardId === board.id) {
          setTitleDraft(updated.name);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to rename whiteboard.");
      }
    });
  }

  function handleDelete(board: WhiteboardDTO) {
    if (!window.confirm(`Delete "${board.name}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        await deleteWhiteboard(board.id);
        setWhiteboards((current) => {
          const nextBoards = current.filter((item) => item.id !== board.id);
          if (selectedWhiteboardId === board.id) {
            setSelectedWhiteboardId(nextBoards[0]?.id ?? null);
          }
          return nextBoards;
        });
        setBoardMenuId(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete whiteboard.");
      }
    });
  }

  function handleTitleBlur() {
    if (!selectedWhiteboard || titleDraft.trim() === selectedWhiteboard.name) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const updated = await renameWhiteboard(selectedWhiteboard.id, {
          name: titleDraft,
          color: selectedWhiteboard.color,
        });
        replaceWhiteboard(updated);
      } catch (error) {
        setTitleDraft(selectedWhiteboard.name);
        setMessage(error instanceof Error ? error.message : "Unable to rename whiteboard.");
      }
    });
  }

  async function applySceneElements(skeleton: Array<Record<string, unknown>>) {
    if (!apiRef.current) {
      return;
    }

    const { CaptureUpdateAction, convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const nextElements = convertToExcalidrawElements(skeleton as never, { regenerateIds: true });
    const current = apiRef.current.getSceneElements();
    apiRef.current.updateScene({
      elements: [...current, ...nextElements],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    apiRef.current.scrollToContent(nextElements);
    setSaveStatus("Unsaved");
  }

  function handleAddStickyNote() {
    void applySceneElements([
      {
        type: "rectangle",
        x: 120,
        y: 120,
        width: 220,
        height: 150,
        strokeColor: "#7c6227",
        backgroundColor: stickyColor,
        fillStyle: "solid",
        roughness: 1,
        label: {
          text: "Sticky note",
          fontSize: 24,
          strokeColor: "#292524",
        },
      },
    ]);
  }

  function applyColor(color: string) {
    if (!apiRef.current) {
      return;
    }

    const appState: Partial<AppState> =
      colorTarget === "background"
        ? { currentItemBackgroundColor: color, currentItemFillStyle: "solid" }
        : { currentItemStrokeColor: color };

    if (colorTarget === "sticky") {
      setStickyColor(color);
      return;
    }

    apiRef.current.updateScene({ appState: appState as never });
  }

  function handleGenerateDiagram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startGenerating(async () => {
      setMessage("");
      try {
        const diagram = await generateWhiteboardDiagram(aiPrompt);
        const skeleton = buildDiagramSkeleton(diagram, 120, 180);
        await applySceneElements(skeleton);
        setAiOpen(false);
        setAiPrompt("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to generate diagram.");
      }
    });
  }

  async function handleExportPng() {
    if (!apiRef.current || !selectedWhiteboard || !canExport) {
      setMessage("Add something to the whiteboard before exporting.");
      return;
    }

    const { exportToBlob } = await import("@excalidraw/excalidraw");
    const blob = await exportToBlob({
      elements: apiRef.current.getSceneElements().filter((element) => !element.isDeleted) as never,
      appState: {
        ...sanitizeAppState(apiRef.current.getAppState()),
        exportWithDarkMode: false,
      } as Partial<AppState>,
      files: apiRef.current.getFiles(),
      mimeType: "image/png",
      exportPadding: 24,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(selectedWhiteboard.name)}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleClearBoard() {
    if (!apiRef.current || !window.confirm("Clear all objects from this whiteboard?")) {
      return;
    }

    apiRef.current.updateScene({ elements: [] });
    setMoreOpen(false);
    setSaveStatus("Unsaved");
  }

  useEffect(() => {
    if (!selectedWhiteboard) {
      setTitleDraft("");
      elementsRef.current = [];
      appStateRef.current = {};
      filesRef.current = {};
      lastSavedSignatureRef.current = sceneSignature([], {}, {});
      setSaveStatus("Saved");
      return;
    }

    loadingSceneRef.current = true;
    setTitleDraft(selectedWhiteboard.name);
    elementsRef.current = selectedWhiteboard.sceneElements as ExcalidrawElement[];
    appStateRef.current = sanitizeAppState(selectedWhiteboard.appState);
    filesRef.current = selectedWhiteboard.files as BinaryFiles;
    lastSavedSignatureRef.current = sceneSignature(
      selectedWhiteboard.sceneElements,
      selectedWhiteboard.appState,
      selectedWhiteboard.files
    );
    setSaveStatus("Saved");
    window.setTimeout(() => {
      loadingSceneRef.current = false;
    }, 300);
  }, [selectedWhiteboard?.id]);

  useEffect(() => {
    if (!selectedWhiteboard || saveStatus !== "Unsaved") {
      return;
    }

    const boardId = selectedWhiteboard.id;
    const saveVersion = ++saveVersionRef.current;
    const handle = window.setTimeout(() => {
      setSaveStatus("Saving...");
      startTransition(async () => {
        try {
          const savedSignature = sceneSignature(elementsRef.current, appStateRef.current, filesRef.current);
          const updated = await updateWhiteboard(boardId, {
            sceneElements: elementsRef.current as unknown[],
            appState: appStateRef.current,
            files: filesRef.current as unknown as Record<string, unknown>,
          });
          lastSavedSignatureRef.current = savedSignature;
          replaceWhiteboard(updated);
          if (saveVersionRef.current === saveVersion) {
            setSaveStatus("Saved");
          }
        } catch (error) {
          setSaveStatus("Save failed");
          setMessage(error instanceof Error ? error.message : "Unable to save whiteboard.");
        }
      });
    }, 900);

    return () => window.clearTimeout(handle);
  }, [saveStatus, selectedWhiteboard]);

  return (
    <div className="h-[calc(100vh-3.5rem)] min-h-[680px] overflow-hidden rounded-lg border border-[#e1d8c8] bg-white shadow-sm">
      <div className="flex h-full min-h-0 min-w-0 flex-col md:flex-row">
        <aside className="flex max-h-[240px] shrink-0 flex-col border-b border-[#e8dfcf] bg-[#fffaf0] md:max-h-none md:w-[292px] md:border-b-0 md:border-r">
          <div className="border-b border-[#e8dfcf] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#d85749]">Whiteboards</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#6b675f]">{whiteboards.length} boards</p>
              </div>
              <button
                type="button"
                onClick={handleCreateWhiteboard}
                disabled={isPending}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#ef594a] text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
                aria-label="New Whiteboard"
                title="New Whiteboard"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleCreateWhiteboard}
              disabled={isPending}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#e1d8c8] bg-white text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Whiteboard
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {whiteboards.length ? (
              whiteboards.map((board) => (
                <div key={board.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedWhiteboardId(board.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border p-3 text-left transition",
                      selectedWhiteboard?.id === board.id
                        ? "border-[#f0c7c1] bg-[#fee4df]"
                        : "border-transparent bg-white hover:border-[#e1d8c8]"
                    )}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[#292524]">{board.name}</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-[#77736b]">
                        Updated {formatRelativeTime(board.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardMenuId((value) => (value === board.id ? null : board.id))}
                    className="absolute right-2 top-3 grid h-8 w-8 place-items-center rounded-md text-[#6b675f] transition hover:bg-white hover:text-[#ef594a]"
                    aria-label={`Open actions for ${board.name}`}
                    title="Board actions"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {boardMenuId === board.id ? (
                    <div className="absolute right-2 top-12 z-20 w-44 rounded-md border border-[#e1d8c8] bg-white p-1 text-sm font-bold text-[#403c37] shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setBoardMenuId(null);
                          handleRename(board);
                        }}
                        className="flex h-9 w-full items-center gap-2 rounded px-2 hover:bg-[#fffaf0]"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(board)}
                        className="mt-1 flex h-9 w-full items-center gap-2 rounded bg-[#fff0f1] px-2 text-[#944139] hover:bg-[#fee4df]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-[#d8cdbb] bg-white px-4 py-5 text-center">
                <StickyNote className="mx-auto h-5 w-5 text-[#ef594a]" aria-hidden="true" />
                <p className="mt-2 text-sm font-bold text-[#292524]">No whiteboards yet</p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          {selectedWhiteboard ? (
            <>
              <div className="shrink-0 border-b border-[#e8dfcf] bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: selectedWhiteboard.color }}
                    />
                    <input
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onBlur={handleTitleBlur}
                      className="min-w-[160px] flex-1 bg-transparent text-xl font-bold tracking-tight text-[#111827] outline-none placeholder:text-[#b8afa2]"
                      placeholder="Untitled whiteboard"
                    />
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAiOpen(true)}
                      className="flex h-10 items-center gap-2 rounded-md bg-[#ef594a] px-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]"
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      AI Diagram
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPng}
                      disabled={!canExport}
                      className="grid h-10 w-10 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Export PNG"
                      title={canExport ? "Export PNG" : "Add something before exporting"}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <div
                      className={cn(
                        "flex h-10 items-center gap-2 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-xs font-bold text-[#6b675f]",
                        saveStatus === "Save failed" && "border-[#f0c7c1] bg-[#fff0ed] text-[#944139]",
                        saveStatus === "Saving..." && "border-[#c9eadf] bg-[#eefbf7] text-[#386f61]"
                      )}
                    >
                      {saveStatus === "Saved" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      {saveStatus === "Saving..." ? <Save className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      {saveStatus}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMoreOpen((value) => !value)}
                        className="grid h-10 w-10 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
                        aria-label="More options"
                        title="More options"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {moreOpen ? (
                        <div className="absolute right-0 top-12 z-20 w-44 rounded-md border border-[#e1d8c8] bg-white p-1 text-sm font-bold text-[#403c37] shadow-xl">
                          <button
                            type="button"
                            onClick={handleClearBoard}
                            className="flex h-9 w-full items-center gap-2 rounded px-2 text-[#944139] hover:bg-[#fff0ed]"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Clear board
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-[#e1d8c8] bg-[#fffaf0] p-2">
                  <button
                    type="button"
                    onClick={handleAddStickyNote}
                    className="flex h-9 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-3 text-xs font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]"
                  >
                    <StickyNote className="h-4 w-4 text-[#f4b333]" aria-hidden="true" />
                    Sticky
                  </button>
                  {(["stroke", "background", "text", "sticky"] as ColorTarget[]).map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => setColorTarget(target)}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-md px-3 text-xs font-bold capitalize transition",
                        colorTarget === target ? "bg-[#fee4df] text-[#c94d42]" : "bg-white text-[#6b675f] hover:text-[#ef594a]"
                      )}
                    >
                      {target === "sticky" ? <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> : <Palette className="h-3.5 w-3.5" aria-hidden="true" />}
                      {target}
                    </button>
                  ))}
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {(colorTarget === "background" ? backgroundColors : colorTarget === "sticky" ? stickyColors : strokeColors).map(
                      (color) => (
                        <ColorButton
                          key={color}
                          color={color}
                          selected={colorTarget === "sticky" ? stickyColor === color : false}
                          onClick={() => applyColor(color)}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

              {message ? (
                <div className="shrink-0 border-b border-[#e8dfcf] bg-[#fff7dd] px-4 py-2 text-sm font-bold text-[#7c6227]">
                  {message}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-hidden bg-white">
                <Excalidraw
                  key={selectedWhiteboard.id}
                  excalidrawAPI={(api) => {
                    apiRef.current = api;
                  }}
                  initialData={{
                    elements: selectedWhiteboard.sceneElements as never,
                    appState: sanitizeAppState(selectedWhiteboard.appState) as never,
                    files: selectedWhiteboard.files as never,
                  }}
                  onChange={(elements, appState, files) => {
                    elementsRef.current = elements as readonly ExcalidrawElement[];
                    appStateRef.current = sanitizeAppState(appState);
                    filesRef.current = files;

                    if (loadingSceneRef.current) {
                      return;
                    }

                    const nextSignature = sceneSignature(elements, appStateRef.current, files);
                    if (nextSignature === lastSavedSignatureRef.current) {
                      setSaveStatus((current) => (current === "Unsaved" ? "Saved" : current));
                      return;
                    }

                    setSaveStatus((current) => (current === "Saving..." ? current : "Unsaved"));
                  }}
                />
              </div>
            </>
          ) : (
            <div className="grid h-full min-h-[560px] place-items-center bg-[#fffaf0] p-6 text-center">
              <div className="max-w-[360px]">
                <FileImage className="mx-auto h-11 w-11 text-[#ef594a]" aria-hidden="true" />
                <h2 className="mt-5 text-2xl font-bold text-[#292524]">Create your first whiteboard</h2>
                <p className="mt-3 text-base font-medium leading-7 text-[#6b675f]">
                  Sketch ideas, add sticky notes, and turn prompts into diagrams.
                </p>
                {message ? <p className="mt-4 text-sm font-bold text-[#944139]">{message}</p> : null}
                <button
                  type="button"
                  onClick={handleCreateWhiteboard}
                  disabled={isPending}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Whiteboard
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {aiOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111827]/35 p-4 backdrop-blur-sm">
          <form onSubmit={handleGenerateDiagram} className="my-6 w-full max-w-[560px] rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-black text-[#d85749]">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  AI Diagram Generator
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#111827]">Describe the diagram</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
                  Flowcharts, mind maps, system architecture, journeys, and process diagrams work best.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#ef594a] hover:text-[#ef594a]"
                aria-label="Close AI dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <label className="mt-5 grid gap-2 text-sm font-bold text-[#403c37]">
              Prompt
              <textarea
                required
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                className="min-h-32 resize-none rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 py-3 text-base font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                placeholder="Create a flowchart for a new customer onboarding process..."
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="h-12 rounded-md border border-[#e1d8c8] bg-white px-5 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isGenerating ? "Generating..." : "Generate diagram"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
