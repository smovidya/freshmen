import { and, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { creditPoints } from "../points.service";
import { startTicketedPlay } from "./tickets";

// Target offset the player must drag the marble layer to, in the same
// coordinate space the client reports back in `submit` (px, arena centered
// on 0,0). Never sent to the client at start - only the server holds it
// (in serverState) until submit.
const TARGET_RANGE = 50;
const MAX_DISTANCE = Math.sqrt(2) * TARGET_RANGE;

export function scoreForAccuracy(accuracy: number) {
  if (accuracy >= 100) return 1000;
  if (accuracy >= 90) return 500;
  if (accuracy >= 70) return 300;
  if (accuracy >= 50) return 100;
  return 0;
}

export async function start(
  input: { userId: string; playToken: string },
  db: Db,
) {
  const targetX = Math.round((Math.random() * 2 - 1) * TARGET_RANGE);
  const targetY = Math.round((Math.random() * 2 - 1) * TARGET_RANGE);
  const play = await startTicketedPlay(
    {
      userId: input.userId,
      gameType: "puzzle",
      playToken: input.playToken,
      serverState: JSON.stringify({ targetX, targetY }),
    },
    db,
  );
  const state = JSON.parse(play.serverState!) as {
    targetX: number;
    targetY: number;
  };

  // The target is game information, not a secret. The server still grades the
  // submitted coordinates, while the player finally has something to align.
  return {
    playToken: play.playToken,
    range: TARGET_RANGE,
    targetX: state.targetX,
    targetY: state.targetY,
  };
}

async function ensurePuzzleCredit(
  input: { userId: string; ouid: string; playId: string; points: number },
  db: Db,
) {
  await creditPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: input.points,
    source: "minigame:puzzle",
    refId: input.playId,
  });
}

export async function submit(
  input: {
    userId: string;
    ouid: string;
    playToken: string;
    x: number;
    y: number;
  },
  db: Db,
) {
  const [play] = await db
    .select({
      id: tables.minigamePlays.id,
      status: tables.minigamePlays.status,
      serverState: tables.minigamePlays.serverState,
      resultPayload: tables.minigamePlays.resultPayload,
      pointsAwarded: tables.minigamePlays.pointsAwarded,
    })
    .from(tables.minigamePlays)
    .where(
      and(
        eq(tables.minigamePlays.playToken, input.playToken),
        eq(tables.minigamePlays.userId, input.userId),
        eq(tables.minigamePlays.gameType, "puzzle"),
      ),
    );

  if (!play) throw new Error("ไม่พบการเล่นนี้");

  if (play.status === "submitted" && play.resultPayload) {
    const result = JSON.parse(play.resultPayload) as {
      accuracy: number;
      points: number;
    };
    await ensurePuzzleCredit(
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

  const { targetX, targetY } = JSON.parse(play.serverState!) as {
    targetX: number;
    targetY: number;
  };
  const distance = Math.sqrt(
    (input.x - targetX) ** 2 + (input.y - targetY) ** 2,
  );
  const accuracy = Math.max(
    0,
    Math.min(100, 100 * (1 - distance / MAX_DISTANCE)),
  );
  const points = scoreForAccuracy(accuracy);
  const result = { accuracy, points };

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

  await ensurePuzzleCredit(
    { userId: input.userId, ouid: input.ouid, playId: play.id, points },
    db,
  );
  return result;
}
