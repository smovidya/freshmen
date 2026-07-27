import { and, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { creditPoints } from "../points.service";
import { startTicketedPlay } from "./tickets";

export const RHYTHM_CONFIG = {
  bpm: 120,
  beatIntervalMs: 500,
  countInBeats: 4,
  scoringBeats: 8,
  hitWindowMs: 180,
} as const;

type RhythmScore = {
  points: number;
  perfect: number;
  great: number;
  good: number;
  misses: number;
  averageOffsetMs: number;
};

export function scoreRhythmTaps(
  tapOffsetsMs: number[],
  config = RHYTHM_CONFIG,
): RhythmScore {
  const targets = Array.from(
    { length: config.scoringBeats },
    (_, index) => (config.countInBeats + index) * config.beatIntervalMs,
  );
  const available = tapOffsetsMs
    .filter(Number.isFinite)
    .map((value, index) => ({ value, index }));
  const used = new Set<number>();
  const result: RhythmScore = {
    points: 0,
    perfect: 0,
    great: 0,
    good: 0,
    misses: 0,
    averageOffsetMs: 0,
  };
  const offsets: number[] = [];

  for (const target of targets) {
    let best: { index: number; diff: number } | null = null;
    for (const tap of available) {
      if (used.has(tap.index)) continue;
      const diff = Math.abs(tap.value - target);
      if (!best || diff < best.diff) best = { index: tap.index, diff };
    }

    if (!best || best.diff > config.hitWindowMs) {
      result.misses += 1;
      continue;
    }

    used.add(best.index);
    offsets.push(best.diff);
    if (best.diff <= 50) {
      result.perfect += 1;
      result.points += 7_500;
    } else if (best.diff <= 100) {
      result.great += 1;
      result.points += 5_000;
    } else {
      result.good += 1;
      result.points += 2_500;
    }
  }

  result.averageOffsetMs =
    offsets.length === 0
      ? config.hitWindowMs
      : offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  return result;
}

export async function start(
  input: { userId: string; playToken: string },
  db: Db,
) {
  const play = await startTicketedPlay(
    {
      userId: input.userId,
      gameType: "precision",
      playToken: input.playToken,
      serverState: JSON.stringify(RHYTHM_CONFIG),
    },
    db,
  );
  const config = JSON.parse(play.serverState!) as typeof RHYTHM_CONFIG;
  return { playToken: play.playToken, ...config };
}

async function ensurePrecisionCredit(
  input: { userId: string; ouid: string; playId: string; points: number },
  db: Db,
) {
  await creditPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: input.points,
    source: "minigame:precision",
    refId: input.playId,
  });
}

export async function submit(
  input: {
    userId: string;
    ouid: string;
    playToken: string;
    tapOffsetsMs: number[];
    clientDurationMs: number;
  },
  db: Db,
) {
  const [play] = await db
    .select({
      id: tables.minigamePlays.id,
      status: tables.minigamePlays.status,
      serverState: tables.minigamePlays.serverState,
      resultPayload: tables.minigamePlays.resultPayload,
      startedAt: tables.minigamePlays.startedAt,
    })
    .from(tables.minigamePlays)
    .where(
      and(
        eq(tables.minigamePlays.playToken, input.playToken),
        eq(tables.minigamePlays.userId, input.userId),
        eq(tables.minigamePlays.gameType, "precision"),
      ),
    );

  if (!play) throw new Error("ไม่พบการเล่นนี้");
  if (play.status === "submitted" && play.resultPayload) {
    const result = JSON.parse(play.resultPayload) as RhythmScore;
    await ensurePrecisionCredit(
      {
        userId: input.userId,
        ouid: input.ouid,
        playId: play.id,
        points: result.points,
      },
      db,
    );
    return result;
  }
  if (play.status !== "started") throw new Error("การเล่นนี้ยังไม่พร้อมส่ง");

  const config = JSON.parse(play.serverState!) as typeof RHYTHM_CONFIG;
  const expectedDurationMs =
    (config.countInBeats + config.scoringBeats) * config.beatIntervalMs;
  const serverElapsedMs = Date.now() - play.startedAt.getTime();

  // Exact grading is intentionally based on the same local clock that drove
  // the metronome audio. Server wall time is only a broad anti-impossible-play
  // guard, so mobile network latency cannot move a visible tap into a miss.
  //
  // Bounds tightened after an adversarial review found a script could claim
  // the minimum allowed clientDurationMs while only waiting ~2.5s real time,
  // then submit exact target offsets for a guaranteed max score. Narrower
  // bounds (a few hundred ms of legitimate timer/network jitter, not several
  // seconds) push the forced real wait close to the true ~6s track length.
  // This raises the cost of forging a play; it does not eliminate it - taps
  // are still entirely client-reported, with no independent server signal of
  // when they actually happened. Closing that gap for real needs the server
  // to timestamp each tap itself (a different game design), tracked
  // separately from this hardening pass.
  if (
    input.clientDurationMs < expectedDurationMs - 300 ||
    input.clientDurationMs > expectedDurationMs + 2_000 ||
    serverElapsedMs + 400 < input.clientDurationMs
  ) {
    throw new Error("ข้อมูลจังหวะไม่สมบูรณ์ กรุณาลองด้วยตั๋วใบใหม่");
  }

  const result = scoreRhythmTaps(input.tapOffsetsMs, config);
  const updated = await db
    .update(tables.minigamePlays)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      resultPayload: JSON.stringify(result),
      pointsAwarded: result.points,
    })
    .where(
      and(
        eq(tables.minigamePlays.id, play.id),
        eq(tables.minigamePlays.status, "started"),
      ),
    )
    .returning({ id: tables.minigamePlays.id });

  if (updated.length === 0) return submit(input, db);

  await ensurePrecisionCredit(
    {
      userId: input.userId,
      ouid: input.ouid,
      playId: play.id,
      points: result.points,
    },
    db,
  );
  return result;
}
