"use server";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { spaceShares, spaces, users, workspacePages } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { ensureSpaceRoom, getAvatarColor, grantSpaceRoomAccess, normalizeEmail } from "@/lib/liveblocks";
import { syncCurrentUser } from "@/lib/sync-user";

export type SpaceFilter = "All Spaces" | "Favorites" | "Recently Opened" | "Archived";
export type SpaceSort = "Recently Updated" | "Name" | "Most Pages" | "Favorites";
export type PageTemplate = "Blank Page" | "Project Plan" | "Meeting Notes" | "PRD" | "Research Notes" | "Task Plan";

export type WorkspacePageContent = {
  text: string;
};

export type WorkspacePageDTO = {
  id: number;
  spaceId: number;
  name: string;
  template: PageTemplate;
  description: string;
  isFavorite: boolean;
  isArchived: boolean;
  commentsCount: number;
  linkedTasksCount: number;
  lastEditedBy: string;
  lastEditedByInitials: string;
  content: WorkspacePageContent;
  createdAt: string;
  updatedAt: string;
};

export type SpaceMemberDTO = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  status: "owner" | "active" | "pending";
};

export type SpaceCollaboratorDTO = SpaceMemberDTO & {
  imageUrl: string;
};

export type SpaceDTO = {
  id: number;
  name: string;
  description: string;
  color: string;
  isFavorite: boolean;
  isArchived: boolean;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  members: SpaceMemberDTO[];
  role: "owner" | "shared";
};

export type SpacesPayload = {
  spaces: SpaceDTO[];
  pages: WorkspacePageDTO[];
};

const spaceColors = new Set(["#8b5cf6", "#2d9cdb", "#16866f", "#f59e0b", "#dc3f31", "#e11d48"]);
const pageTemplates: PageTemplate[] = ["Blank Page", "Project Plan", "Meeting Notes", "PRD", "Research Notes", "Task Plan"];

type CurrentWorkspaceUser = {
  id: number;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

function normalizeText(value: string | undefined, fallback: string, maxLength = 160) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function normalizeDescription(value: string | undefined) {
  return value?.trim().slice(0, 420) ?? "";
}

function normalizeColor(value?: string) {
  return value && spaceColors.has(value) ? value : "#8b5cf6";
}

function normalizeTemplate(value?: string): PageTemplate {
  return pageTemplates.includes(value as PageTemplate) ? (value as PageTemplate) : "Blank Page";
}

function normalizeContent(value?: Partial<WorkspacePageContent> | Record<string, unknown>): WorkspacePageContent {
  return { text: typeof value?.text === "string" ? value.text.slice(0, 50000) : "" };
}

function getInitials(value: string) {
  const name = value.replace(/@.*/, "").trim();
  const [first, second] = name.split(/[\s._-]+/);
  return `${first?.[0] ?? "M"}${second?.[0] ?? first?.[1] ?? "E"}`.toUpperCase();
}

function serializePage(page: typeof workspacePages.$inferSelect): WorkspacePageDTO {
  return {
    id: page.id,
    spaceId: page.spaceId,
    name: page.name,
    template: normalizeTemplate(page.template),
    description: page.description,
    isFavorite: page.isFavorite,
    isArchived: page.isArchived,
    commentsCount: page.commentsCount,
    linkedTasksCount: page.linkedTasksCount,
    lastEditedBy: page.lastEditedBy,
    lastEditedByInitials: page.lastEditedByInitials,
    content: normalizeContent(page.content),
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

function serializeSpace(
  space: typeof spaces.$inferSelect,
  pageCount: number,
  members: SpaceMemberDTO[],
  role: "owner" | "shared"
): SpaceDTO {
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    color: space.color,
    isFavorite: space.isFavorite,
    isArchived: space.isArchived,
    lastOpenedAt: space.lastOpenedAt?.toISOString() ?? null,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
    pageCount,
    members,
    role,
  };
}

async function getCurrentWorkspaceUser(): Promise<CurrentWorkspaceUser> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Sign in to manage spaces.");
  }

  await syncCurrentUser();

  const [dbUser] = await db
    .select({ id: users.id, email: users.email, name: users.name, imageUrl: users.imageUrl })
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  if (!dbUser) {
    throw new Error("Unable to load your workspace user.");
  }

  const email = normalizeEmail(dbUser.email);

  await db
    .update(spaceShares)
    .set({ userId: dbUser.id, acceptedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(spaceShares.email, email), isNull(spaceShares.userId)));

  return { ...dbUser, email };
}

async function getAccessibleSpaceIds(user: CurrentWorkspaceUser) {
  const ownedRows = await db.select({ id: spaces.id }).from(spaces).where(eq(spaces.userId, user.id));
  const sharedRows = await db.select({ spaceId: spaceShares.spaceId }).from(spaceShares).where(eq(spaceShares.email, user.email));
  return [...new Set([...ownedRows.map((row) => row.id), ...sharedRows.map((row) => row.spaceId)])];
}

async function requireSpace(user: CurrentWorkspaceUser, spaceId: number) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);

  if (!space) {
    throw new Error("Space not found.");
  }

  if (space.userId === user.id) {
    return space;
  }

  const [share] = await db
    .select({ id: spaceShares.id })
    .from(spaceShares)
    .where(and(eq(spaceShares.spaceId, spaceId), eq(spaceShares.email, user.email)))
    .limit(1);

  if (!share) {
    throw new Error("Space not found.");
  }

  return space;
}

async function requireOwnedSpace(user: CurrentWorkspaceUser, spaceId: number) {
  const space = await requireSpace(user, spaceId);

  if (space.userId !== user.id) {
    throw new Error("Only the space owner can manage collaborators or delete this space.");
  }

  return space;
}

async function requirePage(user: CurrentWorkspaceUser, pageId: number) {
  const [row] = await db
    .select({
      page: workspacePages,
      space: spaces,
    })
    .from(workspacePages)
    .innerJoin(spaces, eq(spaces.id, workspacePages.spaceId))
    .where(eq(workspacePages.id, pageId))
    .limit(1);

  if (!row) {
    throw new Error("Page not found.");
  }

  await requireSpace(user, row.space.id);
  return row;
}

async function getSpaceMembers(spaceRows: Array<typeof spaces.$inferSelect>): Promise<Map<number, SpaceMemberDTO[]>> {
  const memberMap = new Map<number, SpaceMemberDTO[]>();

  if (!spaceRows.length) {
    return memberMap;
  }

  const ownerIds = [...new Set(spaceRows.map((space) => space.userId))];
  const ownerRows = await db.select().from(users).where(inArray(users.id, ownerIds));
  const shareRows = await db
    .select()
    .from(spaceShares)
    .where(inArray(spaceShares.spaceId, spaceRows.map((space) => space.id)))
    .orderBy(asc(spaceShares.createdAt));
  const shareUserIds = shareRows.map((share) => share.userId).filter((id): id is number => Boolean(id));
  const sharedUsers = shareUserIds.length ? await db.select().from(users).where(inArray(users.id, shareUserIds)) : [];

  for (const space of spaceRows) {
    const owner = ownerRows.find((item) => item.id === space.userId);
    const ownerEmail = normalizeEmail(owner?.email ?? "");
    const members: SpaceMemberDTO[] = owner
      ? [
          {
            id: `owner-${owner.id}`,
            name: owner.name ?? owner.email,
            email: owner.email,
            initials: getInitials(owner.name ?? owner.email),
            color: getAvatarColor(owner.email),
            status: "owner",
          },
        ]
      : [];

    for (const share of shareRows.filter((item) => item.spaceId === space.id)) {
      const email = normalizeEmail(share.email);
      if (email === ownerEmail) {
        continue;
      }

      const sharedUser = sharedUsers.find((item) => item.id === share.userId);
      members.push({
        id: `share-${share.id}`,
        name: sharedUser?.name ?? email,
        email,
        initials: getInitials(sharedUser?.name ?? email),
        color: getAvatarColor(email),
        status: share.acceptedAt ? "active" : "pending",
      });
    }

    memberMap.set(space.id, members);
  }

  return memberMap;
}

async function listRawWorkspace(user: CurrentWorkspaceUser) {
  const spaceIds = await getAccessibleSpaceIds(user);
  const spaceRows = spaceIds.length
    ? await db.select().from(spaces).where(inArray(spaces.id, spaceIds)).orderBy(desc(spaces.updatedAt))
    : [];
  const pageRows = spaceIds.length
    ? await db.select().from(workspacePages).where(inArray(workspacePages.spaceId, spaceIds))
    : [];
  const membersBySpace = await getSpaceMembers(spaceRows);

  await Promise.all(
    spaceRows.map(async (space) => {
      const owner = membersBySpace.get(space.id)?.find((member) => member.status === "owner");
      await ensureSpaceRoom({ id: space.id, name: space.name, userEmail: owner?.email ?? user.email });

      if (space.userId !== user.id) {
        await grantSpaceRoomAccess(space.id, user.email);
      }
    })
  );

  return { spaceRows, pageRows, membersBySpace };
}

export async function listSpaces(input?: {
  search?: string;
  filter?: SpaceFilter;
  sort?: SpaceSort;
}): Promise<SpacesPayload> {
  const user = await getCurrentWorkspaceUser();
  const { spaceRows, pageRows, membersBySpace } = await listRawWorkspace(user);
  const query = input?.search?.trim().toLowerCase() ?? "";
  const filter = input?.filter ?? "All Spaces";
  const sort = input?.sort ?? "Recently Updated";

  const pagesBySpace = new Map<number, WorkspacePageDTO[]>();
  for (const page of pageRows.map(serializePage)) {
    const list = pagesBySpace.get(page.spaceId) ?? [];
    list.push(page);
    pagesBySpace.set(page.spaceId, list);
  }

  const filteredSpaces = spaceRows
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

      const searchablePages = pagesBySpace.get(space.id) ?? [];
      return (
        space.name.toLowerCase().includes(query) ||
        space.description.toLowerCase().includes(query) ||
        searchablePages.some(
          (page) =>
            page.name.toLowerCase().includes(query) ||
            page.description.toLowerCase().includes(query) ||
            page.template.toLowerCase().includes(query)
        )
      );
    });

  const sortedSpaces = [...filteredSpaces].sort((a, b) => {
    if (sort === "Name") {
      return a.name.localeCompare(b.name);
    }
    if (sort === "Most Pages") {
      const aCount = (pagesBySpace.get(a.id) ?? []).filter((page) => !page.isArchived).length;
      const bCount = (pagesBySpace.get(b.id) ?? []).filter((page) => !page.isArchived).length;
      return bCount - aCount || b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    if (sort === "Favorites") {
      return Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return {
    spaces: sortedSpaces.map((space) =>
      serializeSpace(
        space,
        (pagesBySpace.get(space.id) ?? []).filter((page) => !page.isArchived).length,
        membersBySpace.get(space.id) ?? [],
        space.userId === user.id ? "owner" : "shared"
      )
    ),
    pages: pageRows.map(serializePage).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  };
}

export async function createSpace(input: { name: string; description?: string; color?: string }) {
  const user = await getCurrentWorkspaceUser();
  const [space] = await db
    .insert(spaces)
    .values({
      userId: user.id,
      name: normalizeText(input.name, "Untitled space"),
      description: normalizeDescription(input.description),
      color: normalizeColor(input.color),
      updatedAt: new Date(),
    })
    .returning();

  await ensureSpaceRoom({ id: space.id, name: space.name, userEmail: user.email });
  revalidatePath("/spaces");
  await logActivity({
    userId: user.id,
    feature: "spaces",
    action: "Created space",
    title: space.name,
    metadata: { spaceId: space.id },
  });
  return serializeSpace(
    space,
    0,
    [
      {
        id: `owner-${user.id}`,
        name: user.name ?? user.email,
        email: user.email,
        initials: getInitials(user.name ?? user.email),
        color: getAvatarColor(user.email),
        status: "owner",
      },
    ],
    "owner"
  );
}

export async function updateSpace(
  spaceId: number,
  input: Partial<{ name: string; description: string; color: string; isFavorite: boolean; isArchived: boolean }>
) {
  const user = await getCurrentWorkspaceUser();
  const currentSpace = await requireSpace(user, spaceId);

  const payload: Partial<typeof spaces.$inferInsert> = { updatedAt: new Date() };
  if (typeof input.name === "string") {
    payload.name = normalizeText(input.name, "Untitled space");
  }
  if (typeof input.description === "string") {
    payload.description = normalizeDescription(input.description);
  }
  if (typeof input.color === "string") {
    payload.color = normalizeColor(input.color);
  }
  if (typeof input.isFavorite === "boolean") {
    payload.isFavorite = input.isFavorite;
  }
  if (typeof input.isArchived === "boolean") {
    payload.isArchived = input.isArchived;
  }

  const [space] = await db.update(spaces).set(payload).where(eq(spaces.id, spaceId)).returning();
  const pages = await db.select().from(workspacePages).where(eq(workspacePages.spaceId, spaceId));
  const membersBySpace = await getSpaceMembers([space]);
  const owner = membersBySpace.get(space.id)?.find((member) => member.status === "owner");
  await ensureSpaceRoom({ id: space.id, name: space.name, userEmail: owner?.email ?? user.email });
  revalidatePath("/spaces");
  await logActivity({
    userId: user.id,
    feature: "spaces",
    action: "Updated space",
    title: space.name,
    metadata: { spaceId: space.id },
  });
  return serializeSpace(
    space,
    pages.filter((page) => !page.isArchived).length,
    membersBySpace.get(space.id) ?? [],
    currentSpace.userId === user.id ? "owner" : "shared"
  );
}

export async function markSpaceOpened(spaceId: number) {
  const user = await getCurrentWorkspaceUser();
  const currentSpace = await requireSpace(user, spaceId);

  const [space] = await db
    .update(spaces)
    .set({ lastOpenedAt: new Date(), updatedAt: new Date() })
    .where(eq(spaces.id, spaceId))
    .returning();

  const pages = await db.select().from(workspacePages).where(eq(workspacePages.spaceId, spaceId));
  const membersBySpace = await getSpaceMembers([space]);
  revalidatePath("/spaces");
  return serializeSpace(
    space,
    pages.filter((page) => !page.isArchived).length,
    membersBySpace.get(space.id) ?? [],
    currentSpace.userId === user.id ? "owner" : "shared"
  );
}

export async function duplicateSpace(spaceId: number) {
  const user = await getCurrentWorkspaceUser();
  const source = await requireSpace(user, spaceId);
  const sourcePages = await db.select().from(workspacePages).where(eq(workspacePages.spaceId, spaceId));
  const [copy] = await db
    .insert(spaces)
    .values({
      userId: user.id,
      name: `${source.name} copy`,
      description: source.description,
      color: source.color,
      updatedAt: new Date(),
    })
    .returning();

  if (sourcePages.length) {
    await db.insert(workspacePages).values(
      sourcePages.map((page) => ({
        spaceId: copy.id,
        name: page.name,
        template: page.template,
        description: page.description,
        content: page.content,
        isFavorite: false,
        isArchived: page.isArchived,
        commentsCount: page.commentsCount,
        linkedTasksCount: page.linkedTasksCount,
        lastEditedBy: user.name ?? "You",
        lastEditedByInitials: getInitials(user.name ?? user.email),
        updatedAt: new Date(),
      }))
    );
  }

  await ensureSpaceRoom({ id: copy.id, name: copy.name, userEmail: user.email });
  revalidatePath("/spaces");
  return serializeSpace(
    copy,
    sourcePages.filter((page) => !page.isArchived).length,
    [
      {
        id: `owner-${user.id}`,
        name: user.name ?? user.email,
        email: user.email,
        initials: getInitials(user.name ?? user.email),
        color: getAvatarColor(user.email),
        status: "owner",
      },
    ],
    "owner"
  );
}

export async function deleteSpace(spaceId: number) {
  const user = await getCurrentWorkspaceUser();
  await requireOwnedSpace(user, spaceId);
  await db.delete(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, user.id)));
  revalidatePath("/spaces");
}

export async function listPages(spaceId: number) {
  const user = await getCurrentWorkspaceUser();
  await requireSpace(user, spaceId);
  const rows = await db.select().from(workspacePages).where(eq(workspacePages.spaceId, spaceId));
  return rows.map(serializePage).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function createPage(input: { spaceId: number; name: string; template?: string; description?: string }) {
  const user = await getCurrentWorkspaceUser();
  await requireSpace(user, input.spaceId);
  const [page] = await db
    .insert(workspacePages)
    .values({
      spaceId: input.spaceId,
      name: normalizeText(input.name, "Untitled page"),
      template: normalizeTemplate(input.template),
      description: normalizeDescription(input.description),
      content: { text: "" },
      lastEditedBy: user.name ?? "You",
      lastEditedByInitials: getInitials(user.name ?? user.email),
      updatedAt: new Date(),
    })
    .returning();

  await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, input.spaceId));
  revalidatePath("/spaces");
  await logActivity({
    userId: user.id,
    feature: "spaces",
    action: "Created page",
    title: page.name,
    metadata: { pageId: page.id, spaceId: page.spaceId },
  });
  return serializePage(page);
}

export async function updatePage(
  pageId: number,
  input: Partial<{
    name: string;
    description: string;
    template: string;
    content: WorkspacePageContent;
    isFavorite: boolean;
    isArchived: boolean;
  }>
) {
  const user = await getCurrentWorkspaceUser();
  const { page } = await requirePage(user, pageId);
  const payload: Partial<typeof workspacePages.$inferInsert> = {
    lastEditedBy: user.name ?? "You",
    lastEditedByInitials: getInitials(user.name ?? user.email),
    updatedAt: new Date(),
  };

  if (typeof input.name === "string") {
    payload.name = normalizeText(input.name, "Untitled page");
  }
  if (typeof input.description === "string") {
    payload.description = normalizeDescription(input.description);
  }
  if (typeof input.template === "string") {
    payload.template = normalizeTemplate(input.template);
  }
  if (input.content) {
    payload.content = normalizeContent(input.content);
  }
  if (typeof input.isFavorite === "boolean") {
    payload.isFavorite = input.isFavorite;
  }
  if (typeof input.isArchived === "boolean") {
    payload.isArchived = input.isArchived;
  }

  const [updated] = await db.update(workspacePages).set(payload).where(eq(workspacePages.id, pageId)).returning();
  await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, page.spaceId));
  revalidatePath("/spaces");
  await logActivity({
    userId: user.id,
    feature: "spaces",
    action: "Updated page",
    title: updated.name,
    metadata: { pageId: updated.id, spaceId: updated.spaceId },
  });
  return serializePage(updated);
}

export async function movePage(pageId: number, spaceId: number) {
  const user = await getCurrentWorkspaceUser();
  const { page } = await requirePage(user, pageId);
  await requireSpace(user, spaceId);

  const [updated] = await db
    .update(workspacePages)
    .set({
      spaceId,
      lastEditedBy: user.name ?? "You",
      lastEditedByInitials: getInitials(user.name ?? user.email),
      updatedAt: new Date(),
    })
    .where(eq(workspacePages.id, pageId))
    .returning();

  await db.update(spaces).set({ updatedAt: new Date() }).where(inArray(spaces.id, [page.spaceId, spaceId]));
  revalidatePath("/spaces");
  return serializePage(updated);
}

export async function duplicatePage(pageId: number) {
  const user = await getCurrentWorkspaceUser();
  const { page } = await requirePage(user, pageId);
  const [copy] = await db
    .insert(workspacePages)
    .values({
      spaceId: page.spaceId,
      name: `${page.name} copy`,
      template: page.template,
      description: page.description,
      content: page.content,
      commentsCount: page.commentsCount,
      linkedTasksCount: page.linkedTasksCount,
      lastEditedBy: user.name ?? "You",
      lastEditedByInitials: getInitials(user.name ?? user.email),
      updatedAt: new Date(),
    })
    .returning();

  await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, page.spaceId));
  revalidatePath("/spaces");
  return serializePage(copy);
}

export async function deletePage(pageId: number) {
  const user = await getCurrentWorkspaceUser();
  const { page } = await requirePage(user, pageId);
  await db.delete(workspacePages).where(eq(workspacePages.id, pageId));
  await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, page.spaceId));
  revalidatePath("/spaces");
}

export async function listSpaceCollaborators(spaceId: number): Promise<SpaceCollaboratorDTO[]> {
  const user = await getCurrentWorkspaceUser();
  const space = await requireSpace(user, spaceId);
  const [owner] = await db.select().from(users).where(eq(users.id, space.userId)).limit(1);
  const shares = await db.select().from(spaceShares).where(eq(spaceShares.spaceId, spaceId)).orderBy(asc(spaceShares.createdAt));
  const shareUserIds = shares.map((share) => share.userId).filter((id): id is number => Boolean(id));
  const sharedUsers = shareUserIds.length ? await db.select().from(users).where(inArray(users.id, shareUserIds)) : [];

  return [
    ...(owner
      ? [
          {
            id: `owner-${owner.id}`,
            name: owner.name ?? owner.email,
            email: owner.email,
            imageUrl: owner.imageUrl ?? "",
            initials: getInitials(owner.name ?? owner.email),
            color: getAvatarColor(owner.email),
            status: "owner" as const,
          },
        ]
      : []),
    ...shares.map((share) => {
      const sharedUser = sharedUsers.find((item) => item.id === share.userId);
      const email = normalizeEmail(share.email);

      return {
        id: `share-${share.id}`,
        name: sharedUser?.name ?? email,
        email,
        imageUrl: sharedUser?.imageUrl ?? "",
        initials: getInitials(sharedUser?.name ?? email),
        color: getAvatarColor(email),
        status: share.acceptedAt ? ("active" as const) : ("pending" as const),
      };
    }),
  ];
}

export async function inviteSpaceCollaborator(spaceId: number, email: string): Promise<SpaceCollaboratorDTO[]> {
  const user = await getCurrentWorkspaceUser();
  const space = await requireOwnedSpace(user, spaceId);
  const normalizedEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (normalizedEmail === user.email || existingUser?.id === space.userId) {
    throw new Error("That user already has access to this space.");
  }

  await db
    .insert(spaceShares)
    .values({
      spaceId,
      email: normalizedEmail,
      userId: existingUser?.id ?? null,
      role: "editor",
      invitedByUserId: user.id,
      acceptedAt: existingUser ? new Date() : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [spaceShares.spaceId, spaceShares.email],
      set: {
        userId: existingUser?.id ?? null,
        role: "editor",
        invitedByUserId: user.id,
        acceptedAt: existingUser ? new Date() : null,
        updatedAt: new Date(),
      },
    });

  await ensureSpaceRoom({ id: space.id, name: space.name, userEmail: user.email });
  await grantSpaceRoomAccess(spaceId, normalizedEmail);

  revalidatePath("/spaces");
  return listSpaceCollaborators(spaceId);
}

export async function sharePage(pageId: number) {
  const user = await getCurrentWorkspaceUser();
  const { space } = await requirePage(user, pageId);
  return listSpaceCollaborators(space.id);
}

export async function exportPage(pageId: number) {
  const user = await getCurrentWorkspaceUser();
  await requirePage(user, pageId);
  return "Export is queued for a future release.";
}
