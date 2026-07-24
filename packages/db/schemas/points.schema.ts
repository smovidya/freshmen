import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
};

// Every discrete point-affecting event (shop purchase, minigame win, friend
// add) writes exactly one row here with a refId pointing at the originating
// row - the (source, refId) unique constraint makes any accidental retry a
// no-op instead of a double payout. High-frequency shake_pop credits have no
// natural per-event id (refId stays null) - SQLite treats multiple NULLs as
// distinct, so this doesn't block repeated pop flushes.
export const pointsLedger = sqliteTable('points_ledger', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  ouid: text('ouid').notNull(),
  delta: integer('delta').notNull(),
  source: text('source').notNull(),
  refId: text('ref_id'),
  ...timestamps,
}, (table) => [
  unique('uniq_points_ledger_source_ref').on(table.source, table.refId),
  index('idx_points_ledger_user').on(table.userId),
]);

// Materialized balance - affordability/cap checks (and the game leaderboard)
// read this, never SUM(points_ledger).
export const pointsBalances = sqliteTable('points_balances', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

// At most one unexpired row per user is enforced in app logic, not here.
export const activeBuffs = sqliteTable('active_buffs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  buffType: text('buff_type').notNull(),
  multiplier: integer('multiplier').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  capAmount: integer('cap_amount').notNull(),
  grantedAmount: integer('granted_amount').notNull().default(0),
  sourcePurchaseId: text('source_purchase_id').notNull().unique(),
  ...timestamps,
}, (table) => [
  index('idx_active_buffs_user').on(table.userId),
]);

export const shopRedemptions = sqliteTable('shop_redemptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  item: text('item').notNull(),
  pointsCost: integer('points_cost').notNull(),
  resultRef: text('result_ref'),
  ...timestamps,
}, (table) => [
  index('idx_shop_redemptions_user').on(table.userId),
]);

export const pointsLedgerRelations = relations(pointsLedger, ({ one }) => ({
  user: one(user, { fields: [pointsLedger.userId], references: [user.id] }),
}));

export const pointsBalancesRelations = relations(pointsBalances, ({ one }) => ({
  user: one(user, { fields: [pointsBalances.userId], references: [user.id] }),
}));

export const activeBuffsRelations = relations(activeBuffs, ({ one }) => ({
  user: one(user, { fields: [activeBuffs.userId], references: [user.id] }),
}));

export const shopRedemptionsRelations = relations(shopRedemptions, ({ one }) => ({
  user: one(user, { fields: [shopRedemptions.userId], references: [user.id] }),
}));

// One row per user - lastClaimedAt null means never claimed, which the
// service treats as immediately eligible ("give everyone on first access").
// No row at all (before a user's very first GET/POST) means the same thing.
export const freeClaims = sqliteTable('free_claims', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  lastClaimedAt: integer('last_claimed_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const freeClaimsRelations = relations(freeClaims, ({ one }) => ({
  user: one(user, { fields: [freeClaims.userId], references: [user.id] }),
}));

// One row per user - tracks the server-observed time of a user's last
// accepted /game/pop request. Lets addPop bound accepted taps by real
// elapsed wall time (server clock only, same idiom as minigame/precision.ts)
// instead of a flat per-request cap, so a scripted/held-down request loop
// can't out-throughput an actual human tapping.
export const popRateLimits = sqliteTable('pop_rate_limits', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  lastPopAt: integer('last_pop_at', { mode: 'timestamp' }).notNull(),
});

export const popRateLimitsRelations = relations(popRateLimits, ({ one }) => ({
  user: one(user, { fields: [popRateLimits.userId], references: [user.id] }),
}));

// Single-use, server-issued token chain gating /game/pop - each accepted pop
// request consumes its token (atomic conditional UPDATE, same idiom as
// minigame_plays.status) and the response carries the next one. Doesn't stop
// a determined scripted attacker (they can fetch a token the same way a real
// client does), but forecloses the simplest attack: capturing one real
// request from devtools/curl and replaying it in a loop forever.
export const popSessions = sqliteTable('pop_sessions', {
  token: text('token').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  consumedAt: integer('consumed_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_pop_sessions_user').on(table.userId),
]);

export const popSessionsRelations = relations(popSessions, ({ one }) => ({
  user: one(user, { fields: [popSessions.userId], references: [user.id] }),
}));

// Best-effort audit trail of pop-endpoint abuse signals (invalid/replayed
// token, elapsed-time throttle clamped a request) for staff to review after
// the event - not auto-punitive, just enough to attribute suspicious score
// growth to a specific ouid if it comes up.
export const anomalyEvents = sqliteTable('anomaly_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  detail: text('detail'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => [
  index('idx_anomaly_events_user').on(table.userId),
  index('idx_anomaly_events_type').on(table.type),
]);

export const anomalyEventsRelations = relations(anomalyEvents, ({ one }) => ({
  user: one(user, { fields: [anomalyEvents.userId], references: [user.id] }),
}));

// Fires once per user per score milestone (67 / 676 / 6767) - the
// (userId, threshold) unique constraint is the sole "already triggered"
// guard, checked via onConflictDoNothing at insert time. notifiedAt null =
// client hasn't been shown/auto-opened this bonus minigame yet; the GET
// endpoint that surfaces pending rows also stamps notifiedAt in the same
// atomic UPDATE, so a page refresh doesn't re-trigger the popup.
export const milestoneTriggers = sqliteTable('milestone_triggers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  threshold: integer('threshold').notNull(),
  gameType: text('game_type').notNull(),
  notifiedAt: integer('notified_at', { mode: 'timestamp' }),
  ...timestamps,
}, (table) => [
  unique('uniq_milestone_triggers_user_threshold').on(table.userId, table.threshold),
  index('idx_milestone_triggers_user').on(table.userId),
]);

export const milestoneTriggersRelations = relations(milestoneTriggers, ({ one }) => ({
  user: one(user, { fields: [milestoneTriggers.userId], references: [user.id] }),
}));
