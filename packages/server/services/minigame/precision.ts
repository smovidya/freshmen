import { and, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { creditPoints } from "../points.service";
import { consumeTicket } from "./tickets";

const TARGET_VALUE = 10.0;
const CYCLE_MAX = 20;
// 1 displayed unit = 1 real second - "หยุดที่ 10.00" means stop the counter
// at 10 real seconds elapsed, a literal stopwatch, not an arbitrary fast
// cycle. (Previously 3700ms/20 units = 185ms/unit, making even a generous
// tolerance a few-millisecond window - unwinnable by human reaction time.)
const CYCLE_PERIOD_MS = CYCLE_MAX * 1000;

// Tiered like puzzle's accuracy bands - a single all-or-nothing ±0.02s
// window (~20ms) is still far tighter than human stop-reaction precision;
// these widths are generous enough to be winnable while still rewarding
// genuine precision with the top prize.
const REWARD_TIERS = [
  { maxDiffSeconds: 0.05, points: 500 },
  { maxDiffSeconds: 0.15, points: 300 },
  { maxDiffSeconds: 0.35, points: 150 },
  { maxDiffSeconds: 0.7, points: 50 },
];

function scoreForDiff(diffSeconds: number): number {
  for (const tier of REWARD_TIERS) {
    if (diffSeconds <= tier.maxDiffSeconds) return tier.points;
  }
  return 0;
}

// The number the client displays is purely cosmetic - both client and server
// derive it from the same deterministic formula, but only the server's own
// elapsed-time measurement (its own clock, from request arrival) is ever
// trusted for scoring. A client can't "report" a better elapsed time than
// what actually passed on the wire.
function valueAtElapsedMs(elapsedMs: number): number {
  return (elapsedMs / (CYCLE_PERIOD_MS / CYCLE_MAX)) % CYCLE_MAX;
}

export async function start(userId: string, db: Db) {
  const ticketId = await consumeTicket(userId, "precision", db);
  const playToken = crypto.randomUUID();
  const serverStartAt = Date.now();

  await db.insert(tables.minigamePlays).values({
    userId,
    gameType: "precision",
    ticketId,
    playToken,
    serverState: JSON.stringify({ serverStartAt }),
  });

  return { playToken, cyclePeriodMs: CYCLE_PERIOD_MS, cycleMax: CYCLE_MAX };
}

export async function submit(input: { userId: string; ouid: string; playToken: string }, db: Db) {
  const [play] = await db
    .update(tables.minigamePlays)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(
      and(
        eq(tables.minigamePlays.playToken, input.playToken),
        eq(tables.minigamePlays.userId, input.userId),
        eq(tables.minigamePlays.status, "started"),
      ),
    )
    .returning({ id: tables.minigamePlays.id, serverState: tables.minigamePlays.serverState });

  if (!play) throw new Error("การเล่นนี้ไม่ถูกต้องหรือถูกส่งไปแล้ว");

  const { serverStartAt } = JSON.parse(play.serverState!) as { serverStartAt: number };
  const elapsedMs = Date.now() - serverStartAt;
  const value = valueAtElapsedMs(elapsedMs);
  const diffSeconds = Math.abs(value - TARGET_VALUE);
  const points = scoreForDiff(diffSeconds);
  const hit = points > 0;

  await db
    .update(tables.minigamePlays)
    .set({ resultPayload: JSON.stringify({ value, hit }), pointsAwarded: points })
    .where(eq(tables.minigamePlays.id, play.id));

  await creditPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: points,
    source: "minigame:precision",
    refId: play.id,
  });

  return { value, hit, points };
}
