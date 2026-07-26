import { and, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { WHEEL_OUTCOMES, type WheelOutcome } from "@vidyafreshmen/dto";
import { creditPoints } from "../points.service";
import { BUFF_CONFIG, grantBuff } from "../shop.service";
import { startTicketedPlay } from "./tickets";

export const WHEEL_WEIGHTS = Object.fromEntries(
  WHEEL_OUTCOMES.map((outcome) => [outcome.key, outcome.weight]),
) as Record<WheelOutcome, number>;

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

export type ChanceReward = {
  outcome: WheelOutcome;
  points: number;
  rewardKind: "points" | "buff" | "none";
  multiplier?: number;
  durationMs?: number;
  convertedFromBuff?: boolean;
};

export async function settleChanceReward(
  input: {
    userId: string;
    ouid: string;
    playId: string;
    source: "wheel" | "mystery_box";
    outcome: WheelOutcome;
  },
  db: Db,
): Promise<ChanceReward> {
  const directPoints = pointsForOutcome(input.outcome);
  if (directPoints > 0) {
    await creditPoints(db, {
      userId: input.userId,
      ouid: input.ouid,
      amount: directPoints,
      source: `minigame:${input.source}`,
      refId: input.playId,
    });
    return {
      outcome: input.outcome,
      points: directPoints,
      rewardKind: "points",
    };
  }

  if (input.outcome === "buff_x3" || input.outcome === "buff_x100") {
    const buff = await grantBuff(db, {
      userId: input.userId,
      buffType: input.outcome,
      sourcePurchaseId: input.playId,
    });
    if (buff) {
      return {
        outcome: input.outcome,
        points: 0,
        rewardKind: "buff",
        multiplier: buff.multiplier,
        durationMs: BUFF_CONFIG[input.outcome].durationMs,
      };
    }

    // An active unrelated buff should never turn a winning slice into nothing.
    // Convert it to the same point value as the corresponding shop item.
    const conversionPoints = BUFF_CONFIG[input.outcome].cost;
    await creditPoints(db, {
      userId: input.userId,
      ouid: input.ouid,
      amount: conversionPoints,
      source: `minigame:${input.source}:buff-conversion`,
      refId: input.playId,
    });
    return {
      outcome: input.outcome,
      points: conversionPoints,
      rewardKind: "points",
      convertedFromBuff: true,
    };
  }

  return { outcome: input.outcome, points: 0, rewardKind: "none" };
}

export async function play(
  input: { userId: string; playToken: string },
  db: Db,
) {
  const outcome = rollWeighted(WHEEL_WEIGHTS);
  const play = await startTicketedPlay(
    {
      userId: input.userId,
      gameType: "wheel",
      playToken: input.playToken,
      serverState: JSON.stringify({ outcome }),
    },
    db,
  );
  const state = JSON.parse(play.serverState!) as { outcome: WheelOutcome };
  return { playToken: play.playToken, outcome: state.outcome };
}

export async function claim(
  input: { userId: string; ouid: string; playToken: string },
  db: Db,
) {
  const [play] = await db
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
        eq(tables.minigamePlays.gameType, "wheel"),
      ),
    );

  if (!play) throw new Error("ไม่พบการหมุนวงล้อนี้");
  if (play.status === "submitted" && play.resultPayload) {
    return JSON.parse(play.resultPayload) as ChanceReward;
  }
  if (play.status !== "started") throw new Error("รางวัลนี้ยังไม่พร้อมรับ");

  const { outcome } = JSON.parse(play.serverState!) as {
    outcome: WheelOutcome;
  };
  const result = await settleChanceReward(
    {
      userId: input.userId,
      ouid: input.ouid,
      playId: play.id,
      source: "wheel",
      outcome,
    },
    db,
  );

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

  if (updated.length === 0) return claim(input, db);
  return result;
}
