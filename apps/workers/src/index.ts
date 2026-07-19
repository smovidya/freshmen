import { createDatabaseConnection } from '@vidyafreshmen/db';
import { syncTables } from './config/sheets';
import { getDueTables } from './lib/sync-state';

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const db = createDatabaseConnection(env.DB);
    const dueKeys = await getDueTables(db, syncTables, new Date());
    if (dueKeys.length === 0) return;
    await env.SYNC_TO_GOOGLE_SHEET.create({ params: { tableKeys: dueKeys } });
  },
} satisfies ExportedHandler<Env>;

export * from './workflows';
