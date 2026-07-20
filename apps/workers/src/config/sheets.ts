import { asc, eq, gt } from 'drizzle-orm';
import { tables, type Db } from '@vidyafreshmen/db';

export type SyncColumn<Row> = {
  header: string;
  value: (row: Row) => string;
};

export type FullSyncTable<Row = any> = {
  key: string;
  mode: 'full';
  sheetTitle: string;
  intervalMinutes: number;
  // 'upsert' (update changed rows only, no full rewrite) is modeled here for a
  // future pass but not implemented yet - only 'rewrite' is handled by the workflow.
  strategy: 'rewrite';
  query: (db: Db) => Promise<Row[]>;
  columns: SyncColumn<Row>[];
};

export type PartialSyncTable<Row = any> = {
  key: string;
  mode: 'partial';
  sheetTitle: string;
  intervalMinutes: number;
  // Must return only rows newer than `cursor`, ordered ascending by the same field
  // `getCursorValue` reads - the workflow advances the cursor to the last row's value.
  query: (db: Db, cursor: Date | null) => Promise<Row[]>;
  getCursorValue: (row: Row) => Date;
  columns: SyncColumn<Row>[];
};

export type SyncTable = FullSyncTable | PartialSyncTable;

export const spreadsheetUrl =
  'https://docs.google.com/spreadsheets/d/1F_jmMvLxr2ec--r2Drj_AIU5kO9eU7wlvsIQEVdpcAQ/edit';

const studentsSync: FullSyncTable<typeof tables.students.$inferSelect> = {
  key: 'students',
  mode: 'full',
  sheetTitle: 'students',
  intervalMinutes: 10,
  strategy: 'rewrite',
  query: (db) => db.select().from(tables.students),
  columns: [
    { header: 'id', value: (r) => r.id },
    { header: 'title', value: (r) => r.title },
    { header: 'first_name', value: (r) => r.firstName },
    { header: 'last_name', value: (r) => r.lastName },
    { header: 'nickname', value: (r) => r.nickname ?? '' },
    { header: 'student_id', value: (r) => r.studentId },
    { header: 'department', value: (r) => r.department },
    { header: 'email', value: (r) => r.email },
    { header: 'phone', value: (r) => r.phone },
    { header: 'emergency_contact_name', value: (r) => r.emergencyContactName },
    { header: 'emergency_contact_phone', value: (r) => r.emergencyContactPhone },
    { header: 'emergency_contact_relationship', value: (r) => r.emergencyContactRelationship },
    { header: 'medical_conditions', value: (r) => r.medicalConditions ?? '' },
    { header: 'allergies', value: (r) => r.dragAllergies ?? '' },
    { header: 'food_allergies', value: (r) => r.foodAllergies ?? '' },
    { header: 'food_limitations', value: (r) => r.foodLimitations ?? '' },
    { header: 'team_owned_id', value: (r) => r.teamOwnedId ?? '' },
    { header: 'team_id', value: (r) => r.teamId ?? '' },
    { header: 'created_at', value: (r) => r.createdAt.toISOString() },
    { header: 'updated_at', value: (r) => r.updatedAt.toISOString() },
  ],
};

const teamsSync: FullSyncTable<typeof tables.teams.$inferSelect> = {
  key: 'teams',
  mode: 'full',
  sheetTitle: 'teams',
  intervalMinutes: 10,
  strategy: 'rewrite',
  query: (db) => db.select().from(tables.teams),
  columns: [
    { header: 'id', value: (r) => r.id },
    { header: 'creator_id', value: (r) => r.creatorId },
    { header: 'group_number_preference_order', value: (r) => r.groupNumberPreferenceOrder ?? '' },
    { header: 'is_submitted', value: (r) => String(r.isSubmitted) },
    { header: 'result_group_number', value: (r) => r.resultGroupNumber ?? '' },
    { header: 'team_codes', value: (r) => r.teamCodes },
    { header: 'result', value: (r) => r.result },
    { header: 'created_at', value: (r) => r.createdAt.toISOString() },
    { header: 'updated_at', value: (r) => r.updatedAt.toISOString() },
  ],
};

function scansQuery(db: Db, cursor: Date | null) {
  return db
    .select({
      id: tables.scans.id,
      studentId: tables.students.studentId,
      studentFirstName: tables.students.firstName,
      studentLastName: tables.students.lastName,
      staffName: tables.staffs.name,
      staffRole: tables.staffs.staffRole,
      checkpointName: tables.checkpoints.name,
      checkpointType: tables.checkpoints.checkpointType,
      activityName: tables.activities.name,
      scannedAt: tables.scans.createdAt,
    })
    .from(tables.scans)
    .innerJoin(tables.students, eq(tables.scans.studentId, tables.students.id))
    .innerJoin(tables.staffs, eq(tables.scans.staffId, tables.staffs.id))
    .innerJoin(tables.checkpoints, eq(tables.scans.checkpointId, tables.checkpoints.id))
    .innerJoin(tables.activities, eq(tables.checkpoints.activityId, tables.activities.id))
    .where(cursor ? gt(tables.scans.createdAt, cursor) : undefined)
    .orderBy(asc(tables.scans.createdAt));
}

type ScanRow = Awaited<ReturnType<typeof scansQuery>>[number];

const scansSync: PartialSyncTable<ScanRow> = {
  key: 'scans',
  mode: 'partial',
  sheetTitle: 'scans',
  intervalMinutes: 2,
  query: scansQuery,
  getCursorValue: (row) => row.scannedAt,
  columns: [
    { header: 'scan_id', value: (r) => r.id },
    { header: 'student_id', value: (r) => r.studentId },
    { header: 'student_name', value: (r) => `${r.studentFirstName} ${r.studentLastName}` },
    { header: 'staff_name', value: (r) => r.staffName },
    { header: 'staff_role', value: (r) => r.staffRole },
    { header: 'checkpoint_name', value: (r) => r.checkpointName },
    { header: 'checkpoint_type', value: (r) => r.checkpointType },
    { header: 'activity_name', value: (r) => r.activityName },
    { header: 'scanned_at', value: (r) => r.scannedAt.toISOString() },
  ],
};

function studentGroupQuery(db: Db, cursor: Date | null) {
  return db
    .select()
    .from(tables.studentGroup)
    .where(cursor ? gt(tables.studentGroup.createdAt, cursor) : undefined)
    .orderBy(asc(tables.studentGroup.createdAt));
}

type StudentGroupRow = Awaited<ReturnType<typeof studentGroupQuery>>[number];

const studentGroupSync: PartialSyncTable<StudentGroupRow> = {
  key: 'student_group',
  mode: 'partial',
  sheetTitle: 'student_group',
  intervalMinutes: 2,
  query: studentGroupQuery,
  getCursorValue: (row) => row.createdAt,
  columns: [
    { header: 'id', value: (r) => r.id },
    { header: 'student_id', value: (r) => r.studentId },
    { header: 'group_number', value: (r) => String(r.groupNumber) },
    { header: 'subgroup_number', value: (r) => String(r.subgroupNumber) },
    { header: 'created_at', value: (r) => r.createdAt.toISOString() },
    { header: 'updated_at', value: (r) => r.updatedAt.toISOString() },
  ],
};

export const syncTables: SyncTable[] = [studentsSync, teamsSync, scansSync, studentGroupSync];
