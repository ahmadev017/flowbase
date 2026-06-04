"use client";

import {
  Archive,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Folder,
  Grid2X2,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  MoreHorizontal,
  MoveRight,
  Plus,
  Quote,
  Search,
  Send,
  Share2,
  Star,
  Type,
  Trash2,
  Underline,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

import {
  PageTemplate,
  SpaceDTO,
  SpaceFilter,
  SpaceSort,
  SpacesPayload,
  WorkspacePageDTO,
  createPage,
  createSpace,
  deletePage,
  deleteSpace,
  duplicatePage,
  duplicateSpace,
  exportPage,
  listSpaces,
  inviteSpaceCollaborator,
  listSpaceCollaborators,
  markSpaceOpened,
  movePage,
  updatePage,
  updateSpace,
  SpaceCollaboratorDTO,
} from "@/app/spaces/actions";
import { cn } from "@/lib/utils";

const spaceColors = ["#8b5cf6", "#2d9cdb", "#16866f", "#f59e0b", "#dc3f31", "#e11d48"];
const filters: SpaceFilter[] = ["All Spaces", "Favorites", "Recently Opened", "Archived"];
const sortOptions: SpaceSort[] = ["Recently Updated", "Name", "Most Pages", "Favorites"];
const pageTemplates: PageTemplate[] = ["Blank Page", "Project Plan", "Meeting Notes", "PRD", "Research Notes", "Task Plan"];

type ViewMode = "grid" | "list";
type Screen =
  | { name: "spaces" }
  | { name: "space"; spaceId: number }
  | { name: "page"; spaceId: number; pageId: number };

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Never opened";
  }

  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(delta / 60000));

  if (minutes < 1) {
    return "Updated just now";
  }
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days === 1) {
    return "Updated yesterday";
  }
  if (days < 7) {
    return `Updated ${days} days ago`;
  }

  return "Updated last week";
}

function formatPageTime(value: string) {
  return formatRelativeTime(value).replace("Updated ", "");
}

function templateType(template: PageTemplate) {
  if (template === "Meeting Notes") {
    return "Notes";
  }
  if (template === "Task Plan") {
    return "Planning";
  }
  if (template === "Research Notes") {
    return "Reference";
  }
  if (template === "PRD") {
    return "Document";
  }
  return template;
}

function defaultPageDescription(template: PageTemplate) {
  if (template === "Blank Page") {
    return "A clean page ready for notes, plans, and supporting context.";
  }
  return `A ${template.toLowerCase()} page for organizing decisions, details, and next steps.`;
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#111827]/35 p-0 backdrop-blur-sm sm:p-4">
      <aside className="h-full w-full overflow-y-auto border-l border-[#e8dfcf] bg-[#fffaf0] p-5 shadow-xl sm:max-w-[430px] sm:rounded-lg sm:border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#111827]">{title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] transition hover:border-[#8b5cf6] hover:text-[#6d28d9]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-[#c4b5fd] bg-white px-5 py-12 text-center">
      <div className="max-w-[360px]">
        <Icon className="mx-auto h-10 w-10 text-[#8b5cf6]" aria-hidden="true" />
        <h2 className="mt-5 text-2xl font-bold text-[#111827]">{title}</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#6b675f]">{description}</p>
        <div className="mt-6">{action}</div>
      </div>
    </div>
  );
}

function CollaborationPanel({
  space,
  onClose,
}: {
  space: SpaceDTO;
  onClose: () => void;
}) {
  const [collaborators, setCollaborators] = useState<SpaceCollaboratorDTO[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    startTransition(async () => {
      try {
        const items = await listSpaceCollaborators(space.id);
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
  }, [space.id]);

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage("");
      try {
        const items = await inviteSpaceCollaborator(space.id, email);
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
      <aside className="h-full w-full overflow-y-auto border-l border-[#e8dfcf] bg-white p-5 shadow-xl sm:max-w-[420px] sm:rounded-lg sm:border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-black text-[#d85749]">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Collaboration
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#111827]">{space.name}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
              Invite teammates and see who can open this space.
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
                disabled={isPending || space.role !== "owner"}
                className="grid h-11 w-11 place-items-center rounded-md bg-[#ef594a] text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
                aria-label="Invite collaborator"
                title={space.role === "owner" ? "Invite collaborator" : "Only the owner can invite collaborators"}
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
          {collaborators.map((collaborator) => (
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
                  collaborator.initials
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
          ))}
        </div>
      </aside>
    </div>
  );
}

export function PagesSpacesPage({
  initialPayload,
  authError,
}: {
  initialPayload: SpacesPayload;
  authError?: string;
}) {
  const [spaces, setSpaces] = useState(initialPayload.spaces);
  const [pages, setPages] = useState(initialPayload.pages);
  const [screen, setScreen] = useState<Screen>({ name: "spaces" });
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<SpaceFilter>("All Spaces");
  const [sort, setSort] = useState<SpaceSort>("Recently Updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [spaceModalOpen, setSpaceModalOpen] = useState(false);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [spaceColor, setSpaceColor] = useState(spaceColors[0]);
  const [pageName, setPageName] = useState("");
  const [pageDescription, setPageDescription] = useState("");
  const [pageSpaceId, setPageSpaceId] = useState<number | "">("");
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>("Blank Page");
  const [openSpaceMenuId, setOpenSpaceMenuId] = useState<number | null>(null);
  const [openPageMenuId, setOpenPageMenuId] = useState<number | null>(null);
  const [collaborationSpace, setCollaborationSpace] = useState<SpaceDTO | null>(null);
  const [pageContentDraft, setPageContentDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<"Saved" | "Saving..." | "Unsaved" | "Save failed">("Saved");
  const [message, setMessage] = useState(authError ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPageDescription(defaultPageDescription(pageTemplate));
  }, [pageTemplate]);

  const visibleSpaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return spaces
      .filter((space) => {
        if (filter === "Archived") {
          return space.isArchived;
        }
        if (space.isArchived) {
          return false;
        }
        if (filter === "Favorites") {
          return space.isFavorite;
        }
        if (filter === "Recently Opened") {
          return Boolean(space.lastOpenedAt);
        }
        return true;
      })
      .filter((space) => {
        if (!query) {
          return true;
        }

        const spacePages = pages.filter((page) => page.spaceId === space.id);
        return (
          space.name.toLowerCase().includes(query) ||
          space.description.toLowerCase().includes(query) ||
          spacePages.some(
            (page) =>
              page.name.toLowerCase().includes(query) ||
              page.description.toLowerCase().includes(query) ||
              page.template.toLowerCase().includes(query)
          )
        );
      })
      .sort((a, b) => {
        if (sort === "Name") {
          return a.name.localeCompare(b.name);
        }
        if (sort === "Most Pages") {
          return b.pageCount - a.pageCount || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        if (sort === "Favorites") {
          return Number(b.isFavorite) - Number(a.isFavorite) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [filter, pages, searchQuery, sort, spaces]);

  const activeSpaces = spaces.filter((space) => !space.isArchived);
  const selectedSpace = screen.name !== "spaces" ? spaces.find((space) => space.id === screen.spaceId) ?? null : null;
  const selectedPage =
    screen.name === "page" ? pages.find((page) => page.id === screen.pageId && page.spaceId === screen.spaceId) ?? null : null;
  const selectedSpacePages = selectedSpace
    ? pages
        .filter((page) => page.spaceId === selectedSpace.id && !page.isArchived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    : [];

  useEffect(() => {
    if (selectedPage) {
      setPageContentDraft(selectedPage.content.text);
      setSaveStatus("Saved");
    }
  }, [selectedPage?.id]);

  useEffect(() => {
    if (!selectedPage || saveStatus !== "Unsaved") {
      return;
    }

    const handle = window.setTimeout(() => {
      const pageId = selectedPage.id;
      const content = pageContentDraft;
      setSaveStatus("Saving...");
      startTransition(async () => {
        try {
          const updated = await updatePage(pageId, { content: { text: content } });
          replacePage(updated);
          setSaveStatus("Saved");
        } catch (error) {
          setSaveStatus("Save failed");
          setMessage(error instanceof Error ? error.message : "Unable to save page.");
        }
      });
    }, 700);

    return () => window.clearTimeout(handle);
  }, [pageContentDraft, saveStatus, selectedPage]);

  function refreshWorkspace() {
    startTransition(async () => {
      try {
        const payload = await listSpaces();
        setSpaces(payload.spaces);
        setPages(payload.pages);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to refresh spaces.");
      }
    });
  }

  function replaceSpace(nextSpace: SpaceDTO) {
    setSpaces((current) => current.map((space) => (space.id === nextSpace.id ? nextSpace : space)));
  }

  function replacePage(nextPage: WorkspacePageDTO) {
    setPages((current) => current.map((page) => (page.id === nextPage.id ? nextPage : page)));
  }

  function openCreatePage(spaceId?: number) {
    const defaultSpaceId = spaceId ?? activeSpaces[0]?.id ?? "";
    setPageName("");
    setPageTemplate("Blank Page");
    setPageDescription(defaultPageDescription("Blank Page"));
    setPageSpaceId(defaultSpaceId);
    setPageModalOpen(true);
  }

  function handleCreateSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage("");
      try {
        const space = await createSpace({ name: spaceName, description: spaceDescription, color: spaceColor });
        setSpaces((current) => [space, ...current]);
        setSpaceName("");
        setSpaceDescription("");
        setSpaceColor(spaceColors[0]);
        setSpaceModalOpen(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create space.");
      }
    });
  }

  function handleCreatePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pageSpaceId) {
      setMessage("Create a space before adding pages.");
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const page = await createPage({
          spaceId: Number(pageSpaceId),
          name: pageName,
          template: pageTemplate,
          description: pageDescription,
        });
        setPages((current) => [page, ...current]);
        setSpaces((current) =>
          current.map((space) =>
            space.id === page.spaceId
              ? { ...space, pageCount: space.pageCount + 1, updatedAt: page.updatedAt }
              : space
          )
        );
        setPageName("");
        setPageModalOpen(false);
        setScreen({ name: "page", spaceId: page.spaceId, pageId: page.id });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create page.");
      }
    });
  }

  function handleOpenSpace(space: SpaceDTO) {
    setScreen({ name: "space", spaceId: space.id });
    setOpenSpaceMenuId(null);
    startTransition(async () => {
      try {
        const updated = await markSpaceOpened(space.id);
        replaceSpace(updated);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to open space.");
      }
    });
  }

  function handleRenameSpace(space: SpaceDTO) {
    const nextName = window.prompt("Rename space", space.name);
    if (nextName === null) {
      return;
    }
    startTransition(async () => {
      try {
        replaceSpace(await updateSpace(space.id, { name: nextName }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to rename space.");
      }
    });
  }

  function handleToggleSpaceFavorite(space: SpaceDTO) {
    startTransition(async () => {
      try {
        replaceSpace(await updateSpace(space.id, { isFavorite: !space.isFavorite }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update favorite.");
      }
    });
  }

  function handleArchiveSpace(space: SpaceDTO) {
    startTransition(async () => {
      try {
        const updated = await updateSpace(space.id, { isArchived: !space.isArchived });
        replaceSpace(updated);
        if (screen.name !== "spaces" && screen.spaceId === space.id && updated.isArchived) {
          setScreen({ name: "spaces" });
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to archive space.");
      }
    });
  }

  function handleDeleteSpace(space: SpaceDTO) {
    if (!window.confirm(`Delete "${space.name}" and all of its pages?`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteSpace(space.id);
        setSpaces((current) => current.filter((item) => item.id !== space.id));
        setPages((current) => current.filter((page) => page.spaceId !== space.id));
        if (screen.name !== "spaces" && screen.spaceId === space.id) {
          setScreen({ name: "spaces" });
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete space.");
      }
    });
  }

  function handleDuplicateSpace(space: SpaceDTO) {
    startTransition(async () => {
      try {
        await duplicateSpace(space.id);
        refreshWorkspace();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to duplicate space.");
      }
    });
  }

  function handleChangeSpaceColor(space: SpaceDTO, color: string) {
    startTransition(async () => {
      try {
        replaceSpace(await updateSpace(space.id, { color }));
        setOpenSpaceMenuId(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to change color.");
      }
    });
  }

  function handleRenamePage(page: WorkspacePageDTO) {
    const nextName = window.prompt("Rename page", page.name);
    if (nextName === null) {
      return;
    }
    startTransition(async () => {
      try {
        replacePage(await updatePage(page.id, { name: nextName }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to rename page.");
      }
    });
  }

  function handleMovePage(page: WorkspacePageDTO, destinationId?: number) {
    const destination = destinationId
      ? activeSpaces.find((space) => space.id === destinationId)
      : activeSpaces.find((space) => space.id !== page.spaceId);
    if (!destination) {
      setMessage("Create another space before moving this page.");
      return;
    }
    startTransition(async () => {
      try {
        const moved = await movePage(page.id, destination.id);
        replacePage(moved);
        refreshWorkspace();
        setScreen({ name: "space", spaceId: destination.id });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to move page.");
      }
    });
  }

  function handleDuplicatePage(page: WorkspacePageDTO) {
    startTransition(async () => {
      try {
        const copy = await duplicatePage(page.id);
        setPages((current) => [copy, ...current]);
        setSpaces((current) =>
          current.map((space) =>
            space.id === copy.spaceId ? { ...space, pageCount: space.pageCount + 1, updatedAt: copy.updatedAt } : space
          )
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to duplicate page.");
      }
    });
  }

  function handleTogglePageFavorite(page: WorkspacePageDTO) {
    startTransition(async () => {
      try {
        replacePage(await updatePage(page.id, { isFavorite: !page.isFavorite }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update favorite.");
      }
    });
  }

  function handleArchivePage(page: WorkspacePageDTO) {
    startTransition(async () => {
      try {
        const archived = await updatePage(page.id, { isArchived: true });
        replacePage(archived);
        setSpaces((current) =>
          current.map((space) =>
            space.id === page.spaceId ? { ...space, pageCount: Math.max(0, space.pageCount - 1), updatedAt: archived.updatedAt } : space
          )
        );
        if (screen.name === "page" && screen.pageId === page.id) {
          setScreen({ name: "space", spaceId: page.spaceId });
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to archive page.");
      }
    });
  }

  function handleDeletePage(page: WorkspacePageDTO) {
    if (!window.confirm(`Delete "${page.name}"?`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deletePage(page.id);
        setPages((current) => current.filter((item) => item.id !== page.id));
        setSpaces((current) =>
          current.map((space) =>
            space.id === page.spaceId ? { ...space, pageCount: Math.max(0, space.pageCount - 1) } : space
          )
        );
        if (screen.name === "page" && screen.pageId === page.id) {
          setScreen({ name: "space", spaceId: page.spaceId });
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete page.");
      }
    });
  }

  function handlePagePlaceholder(action: "share" | "export", page: WorkspacePageDTO) {
    if (action === "share") {
      const space = spaces.find((item) => item.id === page.spaceId);
      if (space) {
        setCollaborationSpace(space);
      }
      return;
    }

    startTransition(async () => {
      try {
        setMessage(await exportPage(page.id));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to complete action.");
      }
    });
  }

  function renderPageActions(page: WorkspacePageDTO, compact = false) {
    const itemClass =
      "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm font-bold text-[#403c37] transition hover:bg-[#f5f3ff] hover:text-[#6d28d9]";

    return (
      <div className={cn("space-y-1", compact ? "w-52" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-4")}>
        <button type="button" onClick={() => handleRenamePage(page)} className={itemClass}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          Rename
        </button>
        <label className={cn(itemClass, "h-auto flex-col items-start gap-1 py-2")}>
          <span className="flex items-center gap-2">
            <MoveRight className="h-4 w-4" aria-hidden="true" />
            Move
          </span>
          <select
            value={page.spaceId}
            onChange={(event) => handleMovePage(page, Number(event.target.value))}
            className="h-9 w-full rounded-md border border-[#e1d8c8] bg-white px-2 text-sm font-bold text-[#403c37] outline-none focus:border-[#ef594a]"
          >
            {activeSpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => handleDuplicatePage(page)} className={itemClass}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Duplicate
        </button>
        <button type="button" onClick={() => handleTogglePageFavorite(page)} className={itemClass}>
          <Star className={cn("h-4 w-4", page.isFavorite && "fill-[#f4b333] text-[#f4b333]")} aria-hidden="true" />
          Favorite
        </button>
        <button type="button" onClick={() => handlePagePlaceholder("share", page)} className={itemClass}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </button>
        <button type="button" onClick={() => handlePagePlaceholder("export", page)} className={itemClass}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </button>
        <button type="button" onClick={() => handleArchivePage(page)} className={itemClass}>
          <Archive className="h-4 w-4" aria-hidden="true" />
          Archive
        </button>
        <button
          type="button"
          onClick={() => handleDeletePage(page)}
          className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm font-bold text-[#b42318] transition hover:bg-[#fff0f1]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    );
  }

  function renderSpaceMenu(space: SpaceDTO) {
    return (
      <div className="absolute right-0 top-11 z-20 w-64 rounded-lg border border-[#ddd6fe] bg-white p-2 text-sm font-bold text-[#403c37] shadow-xl">
        <button type="button" onClick={() => handleRenameSpace(space)} className="flex h-9 w-full items-center gap-2 rounded px-2 hover:bg-[#f5f3ff]">
          <Folder className="h-4 w-4" aria-hidden="true" />
          Rename Space
        </button>
        <button type="button" onClick={() => openCreatePage(space.id)} className="flex h-9 w-full items-center gap-2 rounded px-2 hover:bg-[#f5f3ff]">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Page
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenSpaceMenuId(null);
            setCollaborationSpace(space);
          }}
          className="flex h-9 w-full items-center gap-2 rounded px-2 hover:bg-[#f5f3ff]"
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          Invite Collaborators
        </button>
        <button type="button" onClick={() => handleDuplicateSpace(space)} className="flex h-9 w-full items-center gap-2 rounded px-2 hover:bg-[#f5f3ff]">
          <Copy className="h-4 w-4" aria-hidden="true" />
          Duplicate
        </button>
        <div className="my-2 h-px bg-[#ede9fe]" />
        <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#8a867d]">Change Color</p>
        <div className="grid grid-cols-7 gap-2 px-2 pb-2">
          {spaceColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleChangeSpaceColor(space, color)}
              className={cn("grid h-7 w-7 place-items-center rounded-md border border-[#e1d8c8]", space.color === color && "ring-2 ring-[#111827]/50")}
              style={{ backgroundColor: color }}
              aria-label={`Use ${color}`}
            >
              {space.color === color ? <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
        <div className="my-2 h-px bg-[#ede9fe]" />
        <button type="button" onClick={() => handleArchiveSpace(space)} className="flex h-9 w-full items-center gap-2 rounded px-2 hover:bg-[#f5f3ff]">
          <Archive className="h-4 w-4" aria-hidden="true" />
          {space.isArchived ? "Restore Space" : "Archive"}
        </button>
        <button type="button" onClick={() => handleDeleteSpace(space)} className="flex h-9 w-full items-center gap-2 rounded px-2 text-[#b42318] hover:bg-[#fff0f1]">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    );
  }

  const primaryButton =
    "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#ef594a] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60";
  const iconButton =
    "grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]";

  if (screen.name !== "spaces" && !selectedSpace) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={() => setScreen({ name: "spaces" })} className={primaryButton}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to All Spaces
        </button>
        <EmptyState icon={Folder} title="Space not found" description="This space may have been deleted or archived." action={null} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col text-[#111827]">
      <header className="mb-5 border-b border-[#e8dfcf] pb-5">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#ede9fe] text-[#6d28d9] shadow-sm">
            <Folder className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.08em] text-[#d85749]">Pages & Spaces</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#111827] lg:text-4xl">
              Organize every working document by space.
            </h1>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col rounded-lg border border-[#e1d8c8] bg-white p-4 shadow-[0_1px_2px_rgba(44,38,31,0.08)] sm:p-5 lg:p-6">
      {message ? (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-[#ddd6fe] bg-white px-4 py-3 text-sm font-bold text-[#5f5b55] shadow-sm">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="text-[#8b5cf6]">
            Dismiss
          </button>
        </div>
      ) : null}

      {screen.name === "spaces" ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ede9fe] pb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[#111827]">All Spaces</h2>
              <p className="mt-2 text-sm font-semibold text-[#6b675f]">
                {activeSpaces.length} {activeSpaces.length === 1 ? "space" : "spaces"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSpaceModalOpen(true)} className={primaryButton}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Space
              </button>
              <button
                type="button"
                onClick={() => openCreatePage()}
                disabled={!activeSpaces.length}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a] disabled:opacity-50"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                New Page
              </button>
            </div>
          </header>

          <section className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto]">
            <div className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-[#ddd6fe] bg-white px-3 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-[#8b5cf6]" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#403c37] outline-none placeholder:text-[#8a867d]"
                placeholder="Search spaces or pages..."
              />
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-md border border-[#ddd6fe] bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn("grid h-9 w-9 place-items-center rounded text-[#6b675f]", viewMode === "grid" && "bg-[#ede9fe] text-[#6d28d9]")}
                  aria-label="Grid view"
                >
                  <Grid2X2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn("grid h-9 w-9 place-items-center rounded text-[#6b675f]", viewMode === "list" && "bg-[#ede9fe] text-[#6d28d9]")}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <label className="relative">
                <span className="sr-only">Sort spaces</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SpaceSort)}
                  className="h-11 appearance-none rounded-md border border-[#ddd6fe] bg-white px-3 pr-9 text-sm font-bold text-[#403c37] shadow-sm outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ede9fe]"
                >
                  {sortOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#8a867d]" aria-hidden="true" />
              </label>
            </div>
          </section>

          <div className="mt-4 flex flex-wrap gap-2 rounded-md bg-[#fffaf0] p-2">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "h-10 rounded-md px-3 text-sm font-bold transition",
                  filter === item
                    ? "bg-white text-[#292524] shadow-sm"
                    : "text-[#5f5b55] hover:bg-white/70 hover:text-[#292524]"
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <section className={cn("mt-5", viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3")}>
            {visibleSpaces.length ? (
              visibleSpaces.map((space) => (
                <article
                  key={space.id}
                  className={cn(
                    "group rounded-lg border border-[#ede9fe] bg-white p-5 shadow-[0_1px_2px_rgba(44,38,31,0.08)] transition hover:-translate-y-0.5 hover:border-[#c4b5fd] hover:shadow-md",
                    viewMode === "list" && "flex flex-wrap items-center gap-4"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenSpace(space)}
                    className={cn("min-w-0 flex-1 text-left", viewMode === "grid" && "block w-full")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-white shadow-sm" style={{ backgroundColor: space.color }}>
                        <Folder className="h-6 w-6 fill-white/20" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-bold text-[#111827]">{space.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-[#6b675f]">
                          {space.description || "No description yet."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-bold text-[#6b675f]">
                      <div className="flex -space-x-2">
                        {space.members.map((member) => (
                          <span
                            key={member.id}
                            title={member.name}
                            className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[11px] font-black text-white"
                            style={{ backgroundColor: member.color }}
                          >
                            {member.initials}
                          </span>
                        ))}
                      </div>
                      <span>{space.pageCount} {space.pageCount === 1 ? "Page" : "Pages"}</span>
                      <span className="h-1 w-1 rounded-full bg-[#c4b5fd]" />
                      <span>{formatRelativeTime(space.updatedAt)}</span>
                    </div>
                  </button>
                  <div className="relative mt-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => handleToggleSpaceFavorite(space)} className={iconButton} aria-label="Favorite space">
                      <Star className={cn("h-4 w-4", space.isFavorite && "fill-[#f4b333] text-[#f4b333]")} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenSpaceMenuId((value) => (value === space.id ? null : space.id))}
                      className={iconButton}
                      aria-label="Space actions"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {openSpaceMenuId === space.id ? renderSpaceMenu(space) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className={viewMode === "grid" ? "sm:col-span-2 xl:col-span-3" : ""}>
                <EmptyState
                  icon={Folder}
                  title={spaces.length ? "No spaces match" : "No spaces yet"}
                  description={spaces.length ? "Adjust search or filters to find another space." : "Create your first space to start organizing pages by workspace, project, or area."}
                  action={
                    <button type="button" onClick={() => setSpaceModalOpen(true)} className={primaryButton}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New Space
                    </button>
                  }
                />
              </div>
            )}
          </section>
        </>
      ) : null}

      {screen.name === "space" && selectedSpace ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ede9fe] pb-6">
            <div className="min-w-0">
              <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#6b675f]">
                <button type="button" onClick={() => setScreen({ name: "spaces" })} className="text-[#6d28d9] hover:underline">
                  All Spaces
                </button>
                <span>&gt;</span>
                <span className="truncate text-[#403c37]">{selectedSpace.name}</span>
              </nav>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-lg text-white shadow-sm" style={{ backgroundColor: selectedSpace.color }}>
                  <Folder className="h-6 w-6 fill-white/20" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-[#111827]">{selectedSpace.name}</h1>
                  <p className="mt-1 text-sm font-semibold text-[#6b675f]">
                    {selectedSpace.pageCount} {selectedSpace.pageCount === 1 ? "page" : "pages"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openCreatePage(selectedSpace.id)} className={primaryButton}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Page
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenSpaceMenuId((value) => (value === selectedSpace.id ? null : selectedSpace.id))}
                  className={iconButton}
                  aria-label="Space actions"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
                {openSpaceMenuId === selectedSpace.id ? renderSpaceMenu(selectedSpace) : null}
              </div>
            </div>
          </header>

          <section className="mt-5 flex flex-1 flex-col overflow-hidden rounded-lg border border-[#ede9fe] bg-white shadow-sm">
            {selectedSpacePages.length ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="bg-[#f5f3ff] text-xs font-black uppercase tracking-[0.08em] text-[#6d28d9]">
                    <tr>
                      <th className="px-4 py-3">Page Name</th>
                      <th className="px-4 py-3">Type/Template</th>
                      <th className="px-4 py-3">Last Updated</th>
                      <th className="px-4 py-3">Updated By</th>
                      <th className="px-4 py-3">Favorite</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ede9fe]">
                    {selectedSpacePages.map((page) => (
                      <tr key={page.id} className="transition hover:bg-[#fbfaff]">
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setScreen({ name: "page", spaceId: selectedSpace.id, pageId: page.id })}
                            className="flex min-w-0 items-center gap-3 text-left"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#ede9fe] text-[#6d28d9]">
                              <FileText className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-[#111827]">{page.name}</span>
                              <span className="block truncate text-xs font-semibold text-[#6b675f]">{page.description}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-md bg-[#ede9fe] px-2.5 py-1 text-xs font-black text-[#5b21b6]">
                            {templateType(page.template)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-[#6b675f]">{formatPageTime(page.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#8b5cf6] text-xs font-black text-white">
                            {page.lastEditedByInitials}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button type="button" onClick={() => handleTogglePageFavorite(page)} className={iconButton} aria-label="Favorite page">
                            <Star className={cn("h-4 w-4", page.isFavorite && "fill-[#f4b333] text-[#f4b333]")} aria-hidden="true" />
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPageMenuId((value) => (value === page.id ? null : page.id))}
                              className={iconButton}
                              aria-label="Page actions"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {openPageMenuId === page.id ? (
                              <div className="absolute right-0 top-11 z-20 rounded-lg border border-[#ddd6fe] bg-white p-2 shadow-xl">
                                {renderPageActions(page, true)}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={FileText}
                  title="No pages in this space yet"
                  description="Add the first page to turn this space into a useful workspace."
                  action={
                    <button type="button" onClick={() => openCreatePage(selectedSpace.id)} className={primaryButton}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New Page
                    </button>
                  }
                />
              </div>
            )}
          </section>
        </>
      ) : null}

      {screen.name === "page" && selectedSpace && selectedPage ? (
        <>
          <header className="border-b border-[#e8dfcf] pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#6b675f]">
                <button type="button" onClick={() => setScreen({ name: "space", spaceId: selectedSpace.id })} className="inline-flex items-center gap-2 text-[#403c37] hover:text-[#ef594a]">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {selectedSpace.name}
                </button>
                <span>&gt;</span>
                <span>Pages</span>
              </nav>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openCreatePage(selectedSpace.id)} className={primaryButton}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Page
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenPageMenuId((value) => (value === selectedPage.id ? null : selectedPage.id))}
                    className={iconButton}
                    aria-label="Page actions"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {openPageMenuId === selectedPage.id ? (
                    <div className="absolute right-0 top-11 z-20 rounded-lg border border-[#e1d8c8] bg-white p-2 shadow-xl">
                      {renderPageActions(selectedPage, true)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <section className="mt-4 flex flex-1 flex-col overflow-hidden rounded-lg border border-[#e1d8c8] bg-white shadow-sm">
            <div className="border-b border-[#e8dfcf] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-3xl font-bold tracking-tight text-[#111827]">{selectedPage.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#6b675f]">
                    {selectedPage.template} · Updated {formatPageTime(selectedPage.updatedAt)} · {selectedPage.lastEditedByInitials}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-[#8a867d]">
                  <span className="rounded-full bg-[#fffaf0] px-3 py-1">{saveStatus}</span>
                  <span className="rounded-full bg-[#fffaf0] px-3 py-1">{wordCount(pageContentDraft)} words</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b border-[#e8dfcf] bg-[#fffaf0] px-4 py-2">
              {[
                ["Text", Type],
                ["H1", Heading1],
                ["H2", Heading2],
                ["Bold", Type],
                ["Italic", Italic],
                ["Underline", Underline],
                ["Bullets", List],
                ["Numbers", ListOrdered],
                ["Quote", Quote],
              ].map(([label, Icon]) => {
                const ToolbarIcon = Icon as React.ComponentType<React.SVGProps<SVGSVGElement>>;
                return (
                  <button
                    key={label as string}
                    type="button"
                    title={label as string}
                    className="grid h-9 min-w-9 place-items-center rounded-md px-2 text-xs font-black text-[#57534e] transition hover:bg-white hover:text-[#ef594a]"
                  >
                    {label === "Bold" ? <span>B</span> : <ToolbarIcon className="h-4 w-4" aria-hidden="true" />}
                  </button>
                );
              })}
              <span className="mx-2 h-6 w-px bg-[#e1d8c8]" />
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-black text-[#57534e] transition hover:bg-white hover:text-[#ef594a]"
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Voice
              </button>
            </div>

            <div className="flex flex-1 bg-white px-4 py-6 sm:px-10 lg:px-20">
              <textarea
                value={pageContentDraft}
                onChange={(event) => {
                  setPageContentDraft(event.target.value);
                  setSaveStatus("Unsaved");
                }}
                className="mx-auto block min-h-[520px] flex-1 w-full max-w-4xl resize-y rounded-lg border border-[#e8dfcf] bg-white px-8 py-7 text-lg font-medium leading-8 text-[#292524] outline-none transition placeholder:text-[#8a867d] focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                placeholder="Write the page. Use / for blocks, the mic for voice, or AI Refine on selected text."
              />
            </div>
          </section>
        </>
      ) : null}

      {collaborationSpace ? (
        <CollaborationPanel space={collaborationSpace} onClose={() => setCollaborationSpace(null)} />
      ) : null}

      {spaceModalOpen ? (
        <ModalShell
          title="Create New Space"
          description="Spaces are top-level folders for projects, areas, and collections."
          onClose={() => setSpaceModalOpen(false)}
        >
          <form onSubmit={handleCreateSpace} className="mt-5 space-y-5">
            <label className="grid gap-2 text-sm font-bold text-[#403c37]">
              Space Name
              <input
                required
                value={spaceName}
                onChange={(event) => setSpaceName(event.target.value)}
                className="h-12 rounded-md border border-[#ddd6fe] bg-[#fbfaff] px-4 text-base font-semibold outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ede9fe]"
                placeholder="Product workspace"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#403c37]">
              Description
              <textarea
                value={spaceDescription}
                onChange={(event) => setSpaceDescription(event.target.value)}
                className="min-h-28 resize-none rounded-md border border-[#ddd6fe] bg-[#fbfaff] px-4 py-3 text-base font-semibold outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ede9fe]"
                placeholder="What belongs in this space?"
              />
            </label>
            <div className="grid gap-2">
              <p className="text-sm font-bold text-[#403c37]">Color selector</p>
              <div className="flex flex-wrap gap-3">
                {spaceColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSpaceColor(color)}
                    className={cn("grid h-10 w-10 place-items-center rounded-md border border-[#e1d8c8] shadow-sm", spaceColor === color && "ring-2 ring-[#111827]/50")}
                    style={{ backgroundColor: color }}
                    aria-label={`Use ${color}`}
                  >
                    {spaceColor === color ? <Check className="h-4 w-4 text-white" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setSpaceModalOpen(false)} className="h-11 rounded-md border border-[#ddd6fe] bg-white px-4 text-sm font-bold text-[#403c37]">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className={primaryButton}>
                Create Space
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {pageModalOpen ? (
        <ModalShell
          title="Create New Page"
          description="Add a document to one of your spaces."
          onClose={() => setPageModalOpen(false)}
        >
          <form onSubmit={handleCreatePage} className="mt-5 space-y-5">
            <label className="grid gap-2 text-sm font-bold text-[#403c37]">
              Page Name
              <input
                required
                value={pageName}
                onChange={(event) => setPageName(event.target.value)}
                className="h-12 rounded-md border border-[#ddd6fe] bg-[#fbfaff] px-4 text-base font-semibold outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ede9fe]"
                placeholder="Q2 roadmap"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#403c37]">
              Add to Space
              <select
                required
                value={pageSpaceId}
                onChange={(event) => setPageSpaceId(Number(event.target.value))}
                className="h-12 rounded-md border border-[#ddd6fe] bg-[#fbfaff] px-4 text-base font-semibold outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ede9fe]"
              >
                <option value="" disabled>
                  Select a space
                </option>
                {activeSpaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#403c37]">
              Template
              <select
                value={pageTemplate}
                onChange={(event) => setPageTemplate(event.target.value as PageTemplate)}
                className="h-12 rounded-md border border-[#ddd6fe] bg-[#fbfaff] px-4 text-base font-semibold outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ede9fe]"
              >
                {pageTemplates.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#403c37]">
              Description
              <textarea
                value={pageDescription}
                onChange={(event) => setPageDescription(event.target.value)}
                className="min-h-24 resize-none rounded-md border border-[#ddd6fe] bg-[#fbfaff] px-4 py-3 text-base font-semibold outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ede9fe]"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPageModalOpen(false)} className="h-11 rounded-md border border-[#ddd6fe] bg-white px-4 text-sm font-bold text-[#403c37]">
                Cancel
              </button>
              <button type="submit" disabled={isPending || !activeSpaces.length} className={primaryButton}>
                Create Page
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
      </div>
    </div>
  );
}
