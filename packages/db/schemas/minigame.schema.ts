import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
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

export const minigameTickets = sqliteTable('minigame_tickets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  gameType: text('game_type').notNull(),
  status: text('status').notNull().default('unused'),
  sourcePurchaseId: text('source_purchase_id').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_minigame_tickets_user').on(table.userId),
]);

// Generic across all 5 minigames - per-game data lives in the JSON columns
// rather than 5 near-duplicate tables (see project plan). serverState holds
// anything the server alone must remember between start and submit (random
// target offsets, timer start, chosen quiz question ids); resultPayload holds
// the final graded outcome.
export const minigamePlays = sqliteTable('minigame_plays', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  gameType: text('game_type').notNull(),
  ticketId: text('ticket_id').references(() => minigameTickets.id, { onDelete: 'set null' }),
  playToken: text('play_token').notNull().unique(),
  status: text('status').notNull().default('started'),
  serverState: text('server_state'),
  resultPayload: text('result_payload'),
  pointsAwarded: integer('points_awarded'),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
}, (table) => [
  unique('uniq_minigame_plays_ticket').on(table.ticketId),
  index('idx_minigame_plays_user_game_created').on(table.userId, table.gameType, table.startedAt),
]);

export const quizQuestions = sqliteTable('quiz_questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  questionText: text('question_text').notNull(),
  choices: text('choices').notNull(),
  correctChoiceIndex: integer('correct_choice_index').notNull(),
  points: integer('points').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const minigameTicketsRelations = relations(minigameTickets, ({ one, many }) => ({
  user: one(user, { fields: [minigameTickets.userId], references: [user.id] }),
  plays: many(minigamePlays),
}));

export const minigamePlaysRelations = relations(minigamePlays, ({ one }) => ({
  user: one(user, { fields: [minigamePlays.userId], references: [user.id] }),
  ticket: one(minigameTickets, { fields: [minigamePlays.ticketId], references: [minigameTickets.id] }),
}));
