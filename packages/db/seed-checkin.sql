-- One-off seed for the 25-27 July check-in activity + its 4 day-checkpoints.
-- Run with:
--   wrangler d1 execute DB --local --file=./seed-checkin.sql --config ../../apps/web/wrangler.jsonc
--   wrangler d1 execute DB --remote --file=./seed-checkin.sql --config ../../apps/web/wrangler.jsonc
-- Safe to re-run: fixed ids, INSERT OR IGNORE.

INSERT OR IGNORE INTO activities (id, name, code, description, created_at, updated_at)
VALUES (
  'activity-freshmen-orientation-2026', 'งานปฐมนิเทศน้องใหม่ 2569', 'freshmen-orientation-2026',
  'Check-in points across the 25-27 July freshmen orientation event.',
  unixepoch(), unixepoch()
);

INSERT OR IGNORE INTO checkpoints (id, name, description, activity_id, checkpoint_type, created_at, updated_at)
VALUES
  ('checkpoint-25july-morning', '25july-morning', 'คณะปฐมนิเทศ เช้าวันที่ 25 กรกฎาคม', 'activity-freshmen-orientation-2026', 'morning-registration', unixepoch(), unixepoch()),
  ('checkpoint-25july-afternoon', '25july-afternoon', 'Activity Avenue บ่ายวันที่ 25 กรกฎาคม', 'activity-freshmen-orientation-2026', 'activity-avenue', unixepoch(), unixepoch()),
  ('checkpoint-26july', '26july', 'เช็คชื่อยืนยันเข้าร่วมงาน วันที่ 26 กรกฎาคม', 'activity-freshmen-orientation-2026', 'daily-attendance', unixepoch(), unixepoch()),
  ('checkpoint-27july', '27july', 'เช็คชื่อยืนยันเข้าร่วมงาน วันที่ 27 กรกฎาคม', 'activity-freshmen-orientation-2026', 'daily-attendance', unixepoch(), unixepoch());
