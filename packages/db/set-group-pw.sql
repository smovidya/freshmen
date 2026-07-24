-- Local-dev convenience: mock join_group_password values for available_groups,
-- so the /game join-group flow (game/add-me-to-group.svelte) has something to
-- test against on a fresh local D1. Production passwords are set separately.
-- Run with:
--   wrangler d1 execute DB --local --file=./set-group-pw.sql --config ../../apps/web/wrangler.jsonc
-- Safe to re-run: inserts the row (with password) if the group doesn't exist yet
-- (mirrors seed-available-groups.sql), then updates the password either way.

INSERT OR IGNORE INTO available_groups (id, number, name, max_members, join_group_password, created_at, updated_at)
VALUES
  ('group-1', '1', 'โมโนสยาม แอร์เวย์', 200, 'mono1234', unixepoch(), unixepoch()),
  ('group-3', '3', 'Trisara airways', 200, 'trisara34', unixepoch(), unixepoch()),
  ('group-4', '4', 'Pink Horizon', 200, 'pinkhz45', unixepoch(), unixepoch()),
  ('group-5', '5', 'กล้วยหอมแอร์ไลน์', 200, 'banana567', unixepoch(), unixepoch()),
  ('group-6', '6', 'sixthsenseairline', 200, 'sixth678', unixepoch(), unixepoch()),
  ('group-7', '7', 'สวรรค์ชั้น7แอร์ไลน์', 200, 'heaven789', unixepoch(), unixepoch());

UPDATE available_groups SET join_group_password = 'mono1234' WHERE number = '1';
UPDATE available_groups SET join_group_password = 'trisara34' WHERE number = '3';
UPDATE available_groups SET join_group_password = 'pinkhz45' WHERE number = '4';
UPDATE available_groups SET join_group_password = 'banana567' WHERE number = '5';
UPDATE available_groups SET join_group_password = 'sixth678' WHERE number = '6';
UPDATE available_groups SET join_group_password = 'heaven789' WHERE number = '7';
