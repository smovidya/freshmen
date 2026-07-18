-- Run with:
--   wrangler d1 execute DB --local --file=./seed.sql --config ../../apps/api/wrangler.jsonc
--   wrangler d1 execute DB --remote --file=./seed.sql --config ../../apps/api/wrangler.jsonc

INSERT INTO teams (id, creator_id, group_number_preference_order, is_submitted, team_codes, result, created_at, updated_at)
VALUES ('team-seed-1', '奏', '1,3,4,5,6,7', 0, '594F', '', unixepoch(), unixepoch());

INSERT INTO students (
  id, title, first_name, last_name, nickname, student_id, department, email, phone,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  medical_conditions, allergies, food_allergies, food_limitations,
  team_owned_id, created_at, updated_at
) VALUES (
  '奏', 'Her majesty', 'input.firstName', 'input.lastName', 'input.nickname', '6888888888', 'input.department',
  'input.email@email.input', '1669',
  'input.emergencyContactName', '191', 'input.emergencyContactRelationship',
  'input.medicalConditions', 'input.drugAllergies', 'input.foodAllergies', 'input.foodLimitations',
  'team-seed-1', unixepoch(), unixepoch()
);
