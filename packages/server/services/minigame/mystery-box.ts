import { and, count, eq, gte, sql } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import type { WheelOutcome } from "@vidyafreshmen/dto";
import {
  rollWeighted,
  settleChanceReward,
  WHEEL_WEIGHTS,
  type ChanceReward,
} from "./wheel";

export const MYSTERY_BOX_DAILY_PLAYS = 3;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function startOfBangkokDay(now = new Date()) {
  const shifted = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - BANGKOK_OFFSET_MS,
  );
}

export async function getStatus(userId: string, db: Db) {
  const [row] = await db
    .select({ played: count() })
    .from(tables.minigamePlays)
    .where(
      and(
        eq(tables.minigamePlays.userId, userId),
        eq(tables.minigamePlays.gameType, "mystery_box"),
        gte(tables.minigamePlays.startedAt, startOfBangkokDay()),
      ),
    );
  const played = row?.played ?? 0;
  return {
    played,
    remaining: Math.max(0, MYSTERY_BOX_DAILY_PLAYS - played),
    limit: MYSTERY_BOX_DAILY_PLAYS,
  };
}

export async function open(
  input: { userId: string; ouid: string; playToken: string },
  db: Db,
) {
  const [existing] = await db
    .select({
      id: tables.minigamePlays.id,
      status: tables.minigamePlays.status,
      serverState: tables.minigamePlays.serverState,
      resultPayload: tables.minigamePlays.resultPayload,
    })
    .from(tables.minigamePlays)
    .where(
      and(
        eq(tables.minigamePlays.userId, input.userId),
        eq(tables.minigamePlays.playToken, input.playToken),
        eq(tables.minigamePlays.gameType, "mystery_box"),
      ),
    );

  if (existing?.status === "submitted" && existing.resultPayload) {
    return JSON.parse(existing.resultPayload) as ChanceReward;
  }

  const outcome = existing
    ? (JSON.parse(existing.serverState!) as { outcome: WheelOutcome }).outcome
    : rollWeighted(WHEEL_WEIGHTS);
  const playId = existing?.id ?? crypto.randomUUID();

  if (!existing) {
    const now = new Date();
    const dayStartSeconds = Math.floor(startOfBangkokDay(now).getTime() / 1000);
    const startedAtSeconds = Math.floor(now.getTime() / 1000);
    const inserted = await db.run(sql`
      INSERT INTO minigame_plays (
        id, user_id, game_type, play_token, status, server_state, started_at
      )
      SELECT
        ${playId},
        ${input.userId},
        'mystery_box',
        ${input.playToken},
        'settling',
        ${JSON.stringify({ outcome })},
        ${startedAtSeconds}
      WHERE (
        SELECT COUNT(*)
        FROM minigame_plays
        WHERE user_id = ${input.userId}
          AND game_type = 'mystery_box'
          AND started_at >= ${dayStartSeconds}
      ) < ${MYSTERY_BOX_DAILY_PLAYS}
    `);

    if ((inserted.meta.changes ?? 0) === 0) {
      const [replayed] = await db
        .select({ id: tables.minigamePlays.id })
        .from(tables.minigamePlays)
        .where(
          and(
            eq(tables.minigamePlays.userId, input.userId),
            eq(tables.minigamePlays.playToken, input.playToken),
          ),
        );
      if (!replayed)
        throw new Error("คุณเปิดกล่องสุ่มครบ 3 ครั้งของวันนี้แล้ว");
    }
  }

  const result = await settleChanceReward(
    {
      userId: input.userId,
      ouid: input.ouid,
      playId,
      source: "mystery_box",
      outcome,
    },
    db,
  );

  await db
    .update(tables.minigamePlays)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      resultPayload: JSON.stringify(result),
      pointsAwarded: result.points,
    })
    .where(eq(tables.minigamePlays.id, playId));

  return result;
}
