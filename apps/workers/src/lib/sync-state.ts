import { eq, inArray } from 'drizzle-orm';
import { tables, type Db } from '@vidyafreshmen/db';
import type { SyncTable } from '../config/sheets';

export async function getDueTables(db: Db, syncTables: SyncTable[], now: Date): Promise<string[]> {
  const keys = syncTables.map((table) => table.key);
  const rows = await db
    .select({ syncKey: tables.syncState.syncKey, lastSyncedAt: tables.syncState.lastSyncedAt })
    .from(tables.syncState)
    .where(inArray(tables.syncState.syncKey, keys));

  const lastSyncedByKey = new Map(rows.map((row) => [row.syncKey, row.lastSyncedAt]));

  return syncTables
    .filter((table) => {
      const lastSyncedAt = lastSyncedByKey.get(table.key);
      if (!lastSyncedAt) return true;
      const dueAt = lastSyncedAt.getTime() + table.intervalMinutes * 60_000;
      return now.getTime() >= dueAt;
    })
    .map((table) => table.key);
}

export async function getCursor(db: Db, key: string): Promise<Date | null> {
  const [row] = await db
    .select({ cursor: tables.syncState.cursor })
    .from(tables.syncState)
    .where(eq(tables.syncState.syncKey, key))
    .limit(1);
  return row?.cursor ?? null;
}

// Marks a table as synced "now". Pass `cursor` for partial-sync tables to advance
// their append cursor; omit it for full-sync tables, which only need lastSyncedAt
// updated so getDueTables respects their intervalMinutes.
export async function recordSync(db: Db, key: string, cursor?: Date): Promise<void> {
  const now = new Date();
  await db
    .insert(tables.syncState)
    .values({ syncKey: key, cursor: cursor ?? null, lastSyncedAt: now })
    .onConflictDoUpdate({
      target: tables.syncState.syncKey,
      set: cursor !== undefined ? { cursor, lastSyncedAt: now, updatedAt: now } : { lastSyncedAt: now, updatedAt: now },
    });
}
