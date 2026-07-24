import { and, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { creditPoints } from "../points.service";
import { consumeTicket } from "./tickets";

// Target offset the player must drag the marble layer to, in the same
// coordinate space the client reports back in `submit` (px, arena centered
// on 0,0). Never sent to the client at start - only the server holds it
// (in serverState) until submit.
const TARGET_RANGE = 50;
const MAX_DISTANCE = Math.sqrt(2) * TARGET_RANGE;

function scoreForAccuracy(accuracy: number) {
  if (accuracy >= 100) return 1000;
  if (accuracy >= 90) return 500;
  if (accuracy >= 70) return 300;
  if (accuracy >= 50) return 100;
  return 0;
}

export async function start(userId: string, db: Db) {
  const ticketId = await consumeTicket(userId, "puzzle", db);

  const targetX = Math.round((Math.random() * 2 - 1) * TARGET_RANGE);
  const targetY = Math.round((Math.random() * 2 - 1) * TARGET_RANGE);
  const playToken = crypto.randomUUID();

  await db.insert(tables.minigamePlays).values({
    userId,
    gameType: "puzzle",
    ticketId,
    playToken,
    serverState: JSON.stringify({ targetX, targetY }),
  });

  return { playToken, range: TARGET_RANGE };
}

export async function submit(
  input: { userId: string; ouid: string; playToken: string; x: number; y: number },
  db: Db,
) {
  // Single atomic status-flip is the sole exactly-once gate (see
  // points.service.ts's header note on why no transaction wraps this) -
  // whichever request wins this conditional UPDATE is the only one that
  // proceeds to score and credit.
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

  const { targetX, targetY } = JSON.parse(play.serverState!) as { targetX: number; targetY: number };
  const distance = Math.sqrt((input.x - targetX) ** 2 + (input.y - targetY) ** 2);
  const accuracy = Math.max(0, Math.min(100, 100 * (1 - distance / MAX_DISTANCE)));
  const points = scoreForAccuracy(accuracy);

  await db
    .update(tables.minigamePlays)
    .set({ resultPayload: JSON.stringify({ accuracy }), pointsAwarded: points })
    .where(eq(tables.minigamePlays.id, play.id));

  await creditPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: points,
    source: "minigame:puzzle",
    refId: play.id,
  });

  return { accuracy, points };
}
