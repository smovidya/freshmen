import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const studentGroup = sqliteTable('student_group', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: text('student_id').notNull(),
  groupNumber: integer('group_number').notNull(),
  subgroupNumber: integer('subgroup_number').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});
