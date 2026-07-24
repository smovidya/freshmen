import { and, count, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { creditPoints } from "../points.service";
import { grantBuff } from "../shop.service";
import { pointsForOutcome, rollWeighted, WHEEL_WEIGHTS } from "./wheel";

// Free lifetime allowance (not ticket-gated) - proposed default, see plan's
// open question on cadence (lifetime count vs. daily reset). Note: the
// count-check-then-insert here has a small TOCTOU race under rapid
// concurrent opens from the same user (could get one extra free play) -
// an accepted, low-stakes risk consistent with this app's existing
// tolerance (see anti-cheat "known ceiling" notes), not worth a stronger
// guard for a free/cosmetic-value feature.
export const MYSTERY_BOX_FREE_PLAYS = 3;

export async function open(input: { userId: string; ouid: string }, db: Db) {
  const [row] = await db
    .select({ played: count() })
    .from(tables.minigamePlays)
    .where(and(eq(tables.minigamePlays.userId, input.userId), eq(tables.minigamePlays.gameType, "mystery_box")));

  if ((row?.played ?? 0) >= MYSTERY_BOX_FREE_PLAYS) {
    throw new Error("คุณเปิดกล่องสุ่มครบจำนวนฟรีแล้ว");
  }

  const outcome = rollWeighted(WHEEL_WEIGHTS);
  const points = pointsForOutcome(outcome);

  const [playRow] = await db
    .insert(tables.minigamePlays)
    .values({
      userId: input.userId,
      gameType: "mystery_box",
      playToken: crypto.randomUUID(),
      status: "submitted",
      submittedAt: new Date(),
      resultPayload: JSON.stringify({ outcome }),
      pointsAwarded: points,
    })
    .returning({ id: tables.minigamePlays.id });
  if (!playRow) throw new Error("Failed to record play");

  if (outcome === "buff_x3" || outcome === "buff_x100") {
    await grantBuff(db, { userId: input.userId, buffType: outcome, sourcePurchaseId: playRow.id });
  } else if (points > 0) {
    await creditPoints(db, {
      userId: input.userId,
      ouid: input.ouid,
      amount: points,
      source: "minigame:mystery_box",
      refId: playRow.id,
    });
  }

  return { outcome, points };
}
