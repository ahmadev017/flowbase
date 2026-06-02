import { syncCurrentUser } from "@/lib/sync-user";

export async function SyncUser() {
  await syncCurrentUser();

  return null;
}
