import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

// Directional: adderUserId spent one of their 10 slots adding targetUserId.
// Only the adder is rewarded - the target must separately add the adder's
// code back to earn their own reward. rewardPoints is snapshotted at insert
// time (ladder value x 1.5 if sameGroup is false) so later ladder-config
// tuning doesn't retroactively rewrite history.
export const friendEdges = sqliteTable('friend_edges', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  adderUserId: text('adder_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  targetUserId: text('target_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sameGroup: integer('same_group', { mode: 'boolean' }).notNull(),
  rewardRank: integer('reward_rank').notNull(),
  rewardPoints: integer('reward_points').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => [
  unique('uniq_friend_edges_adder_target').on(table.adderUserId, table.targetUserId),
  index('idx_friend_edges_adder').on(table.adderUserId),
  index('idx_friend_edges_target').on(table.targetUserId),
]);

export const friendEdgesRelations = relations(friendEdges, ({ one }) => ({
  adder: one(user, { fields: [friendEdges.adderUserId], references: [user.id], relationName: 'adder' }),
  target: one(user, { fields: [friendEdges.targetUserId], references: [user.id], relationName: 'target' }),
}));
