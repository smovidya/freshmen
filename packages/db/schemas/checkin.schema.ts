import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { students } from './student.schema';
import { user } from './auth.schema';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
};

export const staffs = sqliteTable('staffs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: text('student_id').notNull(),
  name: text('name').notNull(),
  nickname: text('nickname'),
  staffRole: text('staff_role').notNull(),
  userId: text('user_id').unique().references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_staffs_student_id').on(table.studentId),
]);

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  ...timestamps,
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const checkpoints = sqliteTable('checkpoints', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'restrict' }),
  checkpointType: text('checkpoint_type').notNull(),
  ...timestamps,
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_checkpoints_activity_id').on(table.activityId),
]);

// Inferred join table: activities "have many staffs" but staffs carries no
// activity_id, and staff can work multiple activities - needs a many-to-many
// junction, not in the original 4-table spec.
export const staffActivities = sqliteTable('staff_activities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text('staff_id').notNull().references(() => staffs.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  ...timestamps,
}, (table) => [
  unique('uniq_staff_activities_staff_activity').on(table.staffId, table.activityId),
]);

export const scans = sqliteTable('scans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'restrict' }),
  staffId: text('staff_id').notNull().references(() => staffs.id, { onDelete: 'restrict' }),
  checkpointId: text('checkpoint_id').notNull().references(() => checkpoints.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (table) => [
  unique('uniq_scans_student_checkpoint').on(table.studentId, table.checkpointId),
  index('idx_scans_activity_id').on(table.activityId),
  index('idx_scans_staff_id').on(table.staffId),
]);

export const staffsRelations = relations(staffs, ({ one, many }) => ({
  staffActivities: many(staffActivities),
  scans: many(scans),
  user: one(user, {
    fields: [staffs.userId],
    references: [user.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ many }) => ({
  checkpoints: many(checkpoints),
  staffActivities: many(staffActivities),
  scans: many(scans),
}));

export const checkpointsRelations = relations(checkpoints, ({ one, many }) => ({
  activity: one(activities, {
    fields: [checkpoints.activityId],
    references: [activities.id],
  }),
  scans: many(scans),
}));

export const staffActivitiesRelations = relations(staffActivities, ({ one }) => ({
  staff: one(staffs, {
    fields: [staffActivities.staffId],
    references: [staffs.id],
  }),
  activity: one(activities, {
    fields: [staffActivities.activityId],
    references: [activities.id],
  }),
}));

export const scansRelations = relations(scans, ({ one }) => ({
  student: one(students, {
    fields: [scans.studentId],
    references: [students.id],
  }),
  activity: one(activities, {
    fields: [scans.activityId],
    references: [activities.id],
  }),
  staff: one(staffs, {
    fields: [scans.staffId],
    references: [staffs.id],
  }),
  checkpoint: one(checkpoints, {
    fields: [scans.checkpointId],
    references: [checkpoints.id],
  }),
}));
