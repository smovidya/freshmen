import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  syncKey: text('sync_key').notNull().unique(),
  cursor: integer('cursor', { mode: 'timestamp' }),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});
