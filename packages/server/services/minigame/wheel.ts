import { tables, type Db } from "@vidyafreshmen/db";
import { creditPoints } from "../points.service";
import { grantBuff } from "../shop.service";
import { consumeTicket } from "./tickets";

// Placeholder weights (organizer's ask was "small prizes appear often") -
// tune once the festival team confirms exact percentages. Sums to 100.
export const WHEEL_WEIGHTS = {
  skull: 25,
  pts_100: 30,
  pts_200: 20,
  pts_300: 15,
  pts_1000: 3,
  buff_x3: 5,
  buff_x100: 2,
} as const;

export type WheelOutcome = keyof typeof WHEEL_WEIGHTS;

export function rollWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    if (roll < weight) return key;
    roll -= weight;
  }
  return entries[entries.length - 1]![0];
}

export function pointsForOutcome(outcome: WheelOutcome): number {
  switch (outcome) {
    case "pts_100":
      return 100;
    case "pts_200":
      return 200;
    case "pts_300":
      return 300;
    case "pts_1000":
      return 1000;
    default:
      return 0;
  }
}

export async function play(input: { userId: string; ouid: string }, db: Db) {
  const ticketId = await consumeTicket(input.userId, "wheel", db);

  const outcome = rollWeighted(WHEEL_WEIGHTS);
  const points = pointsForOutcome(outcome);

  const [playRow] = await db
    .insert(tables.minigamePlays)
    .values({
      userId: input.userId,
      gameType: "wheel",
      ticketId,
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
      source: "minigame:wheel",
      refId: playRow.id,
    });
  }

  return { outcome, points };
}
