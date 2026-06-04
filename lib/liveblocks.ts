import { Liveblocks } from "@liveblocks/node";

const avatarColors = ["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259"];

let liveblocksClient: Liveblocks | null | undefined;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getKanbanRoomId(boardId: number) {
  return `flowbase:kanban-board:${boardId}`;
}

export function getSpaceRoomId(spaceId: number) {
  return `flowbase:space:${spaceId}`;
}

export function getAvatarColor(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return avatarColors[hash % avatarColors.length];
}

export function getLiveblocksClient() {
  if (liveblocksClient !== undefined) {
    return liveblocksClient;
  }

  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  liveblocksClient = secret ? new Liveblocks({ secret }) : null;

  return liveblocksClient;
}

export async function ensureKanbanRoom(board: { id: number; name: string; userEmail: string }) {
  const liveblocks = getLiveblocksClient();

  if (!liveblocks) {
    return;
  }

  await liveblocks.upsertRoom(getKanbanRoomId(board.id), {
    update: {
      defaultAccesses: [],
      metadata: {
        boardId: String(board.id),
        boardName: board.name,
        kind: "kanban-board",
      },
      usersAccesses: {
        [normalizeEmail(board.userEmail)]: ["room:write"],
      },
    },
    create: {
      defaultAccesses: [],
      metadata: {
        boardId: String(board.id),
        boardName: board.name,
        kind: "kanban-board",
      },
      usersAccesses: {
        [normalizeEmail(board.userEmail)]: ["room:write"],
      },
    },
  });
}

export async function grantKanbanRoomAccess(boardId: number, email: string) {
  const liveblocks = getLiveblocksClient();

  if (!liveblocks) {
    return;
  }

  await liveblocks.updateRoom(getKanbanRoomId(boardId), {
    defaultAccesses: [],
    usersAccesses: {
      [normalizeEmail(email)]: ["room:write"],
    },
  });
}

export async function ensureSpaceRoom(space: { id: number; name: string; userEmail: string }) {
  const liveblocks = getLiveblocksClient();

  if (!liveblocks) {
    return;
  }

  await liveblocks.upsertRoom(getSpaceRoomId(space.id), {
    update: {
      defaultAccesses: [],
      metadata: {
        spaceId: String(space.id),
        spaceName: space.name,
        kind: "space",
      },
      usersAccesses: {
        [normalizeEmail(space.userEmail)]: ["room:write"],
      },
    },
    create: {
      defaultAccesses: [],
      metadata: {
        spaceId: String(space.id),
        spaceName: space.name,
        kind: "space",
      },
      usersAccesses: {
        [normalizeEmail(space.userEmail)]: ["room:write"],
      },
    },
  });
}

export async function grantSpaceRoomAccess(spaceId: number, email: string) {
  const liveblocks = getLiveblocksClient();

  if (!liveblocks) {
    return;
  }

  await liveblocks.updateRoom(getSpaceRoomId(spaceId), {
    defaultAccesses: [],
    usersAccesses: {
      [normalizeEmail(email)]: ["room:write"],
    },
  });
}
