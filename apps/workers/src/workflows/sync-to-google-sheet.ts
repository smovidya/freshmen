import { WorkflowEntrypoint, type WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import { createDatabaseConnection } from '@vidyafreshmen/db';
import { spreadsheetUrl, syncTables } from '../config/sheets';
import { getDoc, getOrCreateSheet, getServiceAccountAuth, getSpreadsheetId } from '../lib/google-sheets';
import { getCursor, recordSync } from '../lib/sync-state';

type Params = { tableKeys: string[] };

export class SyncToGoogleSheetWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    for (const key of event.payload.tableKeys) {
      const table = syncTables.find((t) => t.key === key);
      if (!table) continue;

      await step.do(`sync:${key}`, async () => {
        const db = createDatabaseConnection(this.env.DB);
        const auth = getServiceAccountAuth(this.env);
        const doc = await getDoc(getSpreadsheetId(spreadsheetUrl), auth);
        const headers = table.columns.map((c) => c.header);
        const sheet = await getOrCreateSheet(doc, table.sheetTitle, headers);

        if (table.mode === 'full') {
          const rows = await table.query(db);
          await sheet.clearRows({ start: 1, end: sheet.rowCount });
          await sheet.setHeaderRow(headers);
          await sheet.addRows(
            rows.map((row) => Object.fromEntries(table.columns.map((c) => [c.header, c.value(row)]))),
          );
          await recordSync(db, table.key);
          return;
        }

        const cursor = await getCursor(db, table.key);
        const rows = await table.query(db, cursor);
        if (rows.length === 0) {
          await recordSync(db, table.key);
          return;
        }

        // Upsert by key: an existing key updates its sheet row in place (so edits
        // that bump updated_at land on the same row), anything unmatched appends.
        const existingRows = await sheet.getRows();
        const rowByKey = new Map(existingRows.map((r) => [String(r.get(table.keyHeader)), r]));

        for (const row of rows) {
          const key = table.getKey(row);
          const values = Object.fromEntries(table.columns.map((c) => [c.header, c.value(row)]));
          const existing = rowByKey.get(key);
          if (existing) {
            existing.assign(values);
            await existing.save();
          } else {
            const newRow = await sheet.addRow(values);
            rowByKey.set(key, newRow);
          }
        }

        const lastRow = rows[rows.length - 1]!;
        await recordSync(db, table.key, table.getCursorValue(lastRow));
      });
    }
  }
}
