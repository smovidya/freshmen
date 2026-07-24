-- One-off seed: staffs roster for ฝ่ายอำนวยการ 1, teams 01 (ประธานฝ่ายอำนวยการ 1)
-- and 02 (ทะเบียน บัตร และ L&F). Source: [RN2026] Contact List sheet, gid=698599299.
-- Run with:
--   wrangler d1 execute DB --local --file=./seed-staff-administration-1.sql --config ../../apps/web/wrangler.jsonc
--   wrangler d1 execute DB --remote --file=./seed-staff-administration-1.sql --config ../../apps/web/wrangler.jsonc
-- Safe to re-run: fixed ids (staff-<student_id>), INSERT OR IGNORE.

INSERT OR IGNORE INTO staffs (id, student_id, name, nickname, staff_role, created_at, updated_at)
VALUES
  -- 01 ประธานฝ่ายอำนวยการ 1
  ('staff-6733021023', '6733021023', 'นาย ปรินทร สว่างผล', 'ปริน', 'ประธานฝ่ายอำนวยการ 1', unixepoch(), unixepoch()),
  ('staff-6731245023', '6731245023', 'นางสาว ศรุตา จารุธรรมวัฒน์', 'อุ้งอิ๊งค์', 'ประธานฝ่ายอำนวยการ 1', unixepoch(), unixepoch()),

  -- 02 ทะเบียน บัตร และ L&F
  ('staff-6831236423', '6831236423', 'นาย พีรพัฒน์ คำกิ่ง', 'มอส', 'หัวหน้าฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6831132823', '6831132823', 'นาย ธนพล ศรีรัตน์', 'ไทร์ทัล', 'หัวหน้าฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6831244423', '6831244423', 'นางสาว ภัททิยา อินทวงศ์', 'ดรีม', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6831232923', '6831232923', 'นางสาว พิชญาภรณ์ แสงจันดา', 'แพท', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6831259923', '6831259923', 'นางสาว อภิญญา วรรณทอง', 'อีส', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6834085523', '6834085523', 'นางสาว มัณฑนกานต์ อุปถัมภ์', 'กระแต', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6831212323', '6831212323', 'นางสาว ณัฐกฤตา หาญณรงค์', 'เจนเจน', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6834010423', '6834010423', 'นางสาว กานต์สินี ธนทรัพย์กิจกุล', 'โอปอล์', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6732406923', '6732406923', 'นางสาว กัญญาภัค ปลายงาม', 'ใบหม่อน', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6832088023', '6832088023', 'นางสาว สุภาพร ษรจันทร์', 'ลูกน้ำ', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6831227823', '6831227823', 'นางสาว ปาลิตา ประสิทธินาวา', 'ต้นข้าว', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6834316523', '6834316523', 'นาย ณัฐพงศ์ จิตรประเวศน์', 'เอเจ', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6832207423', '6832207423', 'นาย จีราวัฒน์ บุญหรั่ง', 'อินดี้', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch()),
  ('staff-6832241723', '6832241723', 'นางสาว สิริธาร ทรายแก้ว', 'โม', 'สมาชิกฝ่ายทะเบียน บัตร และ L&F', unixepoch(), unixepoch());
