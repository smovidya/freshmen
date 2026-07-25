-- Adds the "Central staff" pseudo-group to available_groups, reusing the
-- existing join-group flow (game/add-me-to-group.svelte -> POST /user/group
-- -> updateUserGroup in game.service.ts) so group-less staff can self-bucket
-- into their own "group" for the game leaderboard. `number` is deliberately
-- non-numeric so it can never collide with a real/future airline number
-- (see seed-available-groups.sql: '1','3','4','5','6','7').
--
-- Run with (from packages/db/):
--   bun run db:seed-central-staff:local
--   bun run db:seed-central-staff:staging
--   bun run db:seed-central-staff:remote
--
-- Safe to re-run: INSERT OR IGNORE keyed on the unique `number` column, then
-- UPDATE unconditionally (re)sets the password, same pattern as set-group-pw.sql.
--
-- WARNING: the join code below is a live credential, not a placeholder -
-- don't paste it into any public doc/chat, only hand it to staff directly.
-- There is no admin UI to edit available_groups passwords today - this file
-- (edited + re-run) is the only rotation mechanism.

INSERT OR IGNORE INTO available_groups (id, number, name, max_members, join_group_password, created_at, updated_at)
VALUES
  ('group-central-staff', 'central-staff', 'สตาฟกลาง', 500, 'KE3MHC9V9G', unixepoch(), unixepoch());

UPDATE available_groups SET join_group_password = 'KE3MHC9V9G' WHERE number = 'central-staff';
