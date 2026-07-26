import { and, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import {
  ARCADE_GAMES,
  ARCADE_REWARD_LADDER,
  type ArcadeGameType,
} from "@vidyafreshmen/dto";
import { creditPoints } from "../points.service";
import { logAnomaly } from "../game.service";
import { startTicketedPlay } from "./tickets";

// Fun-first batch (see plan): every one of these ten games is a
// self-contained client-side round that reports one final raw score at
// game-over - no hidden server target, no per-tap trust model, so one
// generic start/submit implementation covers all ten instead of a bespoke
// service file each (contrast puzzle.ts/precision.ts/wheel.ts, which each
// have genuinely different grading logic). Raw score is trusted from the
// client beyond a basic plausibility clamp - deliberately not hardened
// against forgery this round, matching precision/puzzle's already-accepted
// risk profile rather than improving on it.
export function scoreToPoints(
  gameType: ArcadeGameType,
  rawScore: number,
): number {
  const { thresholds } = ARCADE_GAMES[gameType];
  if (rawScore >= thresholds.perfect) return ARCADE_REWARD_LADDER.perfect;
  if (rawScore >= thresholds.gold) return ARCADE_REWARD_LADDER.gold;
  if (rawScore >= thresholds.silver) return ARCADE_REWARD_LADDER.silver;
  if (rawScore >= thresholds.bronze) return ARCADE_REWARD_LADDER.bronze;
  return 0;
}

export async function start(
  input: { userId: string; gameType: ArcadeGameType; playToken: string },
  db: Db,
) {
  const play = await startTicketedPlay(
    {
      userId: input.userId,
      gameType: input.gameType,
      playToken: input.playToken,
      serverState: JSON.stringify({ startedAt: Date.now() }),
    },
    db,
  );
  return {
    playToken: play.playToken,
    roundDurationMs: ARCADE_GAMES[input.gameType].roundDurationMs,
  };
}

async function ensureArcadeCredit(
  input: {
    userId: string;
    ouid: string;
    gameType: ArcadeGameType;
    playId: string;
    points: number;
  },
  db: Db,
) {
  await creditPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: input.points,
    source: `minigame:${input.gameType}`,
    refId: input.playId,
  });
}

export async function submit(
  input: {
    userId: string;
    ouid: string;
    gameType: ArcadeGameType;
    playToken: string;
    rawScore: number | undefined;
  },
  db: Db,
) {
  const [play] = await db
    .select({
      id: tables.minigamePlays.id,
      status: tables.minigamePlays.status,
      resultPayload: tables.minigamePlays.resultPayload,
    })
    .from(tables.minigamePlays)
    .where(
      and(
        eq(tables.minigamePlays.playToken, input.playToken),
        eq(tables.minigamePlays.userId, input.userId),
        eq(tables.minigamePlays.gameType, input.gameType),
      ),
    );

  if (!play) throw new Error("ไม่พบการเล่นนี้");

  if (play.status === "submitted" && play.resultPayload) {
    const result = JSON.parse(play.resultPayload) as {
      rawScore: number;
      points: number;
    };
    await ensureArcadeCredit(
      {
        userId: input.userId,
        ouid: input.ouid,
        gameType: input.gameType,
        playId: play.id,
        points: result.points,
      },
      db,
    );
    return { points: result.points };
  }
  if (play.status !== "started") throw new Error("การเล่นนี้ยังไม่พร้อมส่ง");

  // No usable score in the request at all (missing/undefined, not a
  // legitimate 0-outcome round) - quiet no-op, same "looks identical to an
  // ordinary zero-outcome round" treatment as game.service.ts's desktop-UA
  // gate on /game/pop. No error, no distinguishing signal, play stays
  // started so a genuine retry with a real score still works.
  if (input.rawScore === undefined) {
    return { points: 0 };
  }

  const { maxRawScore } = ARCADE_GAMES[input.gameType];
  const clamped = Math.max(0, Math.min(input.rawScore, maxRawScore));
  if (clamped !== input.rawScore) {
    await logAnomaly(db, {
      userId: input.userId,
      type: "arcade_score_clamped",
      detail: { gameType: input.gameType, reported: input.rawScore, clamped },
    });
  }

  const points = scoreToPoints(input.gameType, clamped);
  // Store the raw, unclamped value alongside what was actually credited so
  // staff can review outliers later even though credited points stay bounded.
  const result = { rawScore: input.rawScore, clampedScore: clamped, points };

  const updated = await db
    .update(tables.minigamePlays)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      resultPayload: JSON.stringify(result),
      pointsAwarded: points,
    })
    .where(
      and(
        eq(tables.minigamePlays.id, play.id),
        eq(tables.minigamePlays.status, "started"),
      ),
    )
    .returning({ id: tables.minigamePlays.id });

  if (updated.length === 0) {
    return submit(input, db);
  }

  await ensureArcadeCredit(
    {
      userId: input.userId,
      ouid: input.ouid,
      gameType: input.gameType,
      playId: play.id,
      points,
    },
    db,
  );
  return { points };
}
