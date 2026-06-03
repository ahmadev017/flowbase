export type Presence = {
  status: "active";
  selectedTaskId?: number | null;
};

export type UserMeta = {
  id: string;
  info: {
    name: string;
    email: string;
    avatar?: string;
    color: string;
  };
};

export type ThreadMetadata = {
  kind: "kanban-task";
  boardId: string;
  taskId: string;
};

export type RoomEvent = never;
export type Storage = Record<string, never>;

declare global {
  interface Liveblocks {
    Presence: Presence;
    Storage: Storage;
    UserMeta: UserMeta;
    RoomEvent: RoomEvent;
    ThreadMetadata: ThreadMetadata;
  }
}
