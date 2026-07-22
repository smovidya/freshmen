-- Local-dev convenience seed for available_groups, mirroring apps/web/src/lib/groups.ts.
-- Production already has these rows (registration/group-choosing has been live) - only
-- needed to exercise the group-choosing/check-in flow against a fresh local D1.
-- Run with:
--   wrangler d1 execute DB --local --file=./seed-available-groups.sql --config ../../apps/web/wrangler.jsonc
-- Safe to re-run: INSERT OR IGNORE keyed on the unique `number` column.

INSERT OR IGNORE INTO available_groups (id, number, name, max_members, created_at, updated_at)
VALUES
  ('group-1', '1', 'โมโนสยาม แอร์เวย์', 200, unixepoch(), unixepoch()),
  ('group-3', '3', 'Trisara airways', 200, unixepoch(), unixepoch()),
  ('group-4', '4', 'Pink Horizon', 200, unixepoch(), unixepoch()),
  ('group-5', '5', 'กล้วยหอมแอร์ไลน์', 200, unixepoch(), unixepoch()),
  ('group-6', '6', 'sixthsenseairline', 200, unixepoch(), unixepoch()),
  ('group-7', '7', 'สวรรค์ชั้น7แอร์ไลน์', 200, unixepoch(), unixepoch());
