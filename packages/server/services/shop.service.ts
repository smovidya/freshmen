import { and, eq, gt } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { TICKETED_GAME_TYPES } from "@vidyafreshmen/dto";
import { creditPoints, debitPoints } from "./points.service";

// D1 batch() is transactional. Fixed write sets use it directly; flows that
// cross the shared point service retain idempotent compensation so a retry
// cannot charge twice or strand a purchase.

export const BUFF_CONFIG = {
  buff_x3: { cost: 300, multiplier: 3, durationMs: 30_000 },
  buff_x100: { cost: 1000, multiplier: 100, durationMs: 10_000 },
} as const;

// Close to the wheel's direct-point expected value, so a paid random play is
// entertainment rather than a disguised 500-point penalty.
export const TICKET_COST = 150;
export const TICKET_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function getCatalog() {
  return {
    buffs: BUFF_CONFIG,
    ticket: { cost: TICKET_COST, gameTypes: TICKETED_GAME_TYPES },
  };
}

// Shared by the shop purchase path and free minigame outcomes (wheel/mystery
// box) that roll a buff as a prize. No stacking: silently skips (returns
// null) if the user already has an unexpired buff, rather than throwing -
// a free prize shouldn't error out the whole request, it just doesn't stack.
export async function grantBuff(
  db: Db,
  input: {
    userId: string;
    buffType: keyof typeof BUFF_CONFIG;
    sourcePurchaseId: string;
  },
) {
  const config = BUFF_CONFIG[input.buffType];

  // Idempotent reward claim: a lost response can ask for the same source
  // again without being mistaken for a conflicting active buff.
  const [sameSource] = await db
    .select({
      buffType: tables.activeBuffs.buffType,
      multiplier: tables.activeBuffs.multiplier,
      expiresAt: tables.activeBuffs.expiresAt,
    })
    .from(tables.activeBuffs)
    .where(eq(tables.activeBuffs.sourcePurchaseId, input.sourcePurchaseId));
  if (sameSource) return sameSource;

  const [existing] = await db
    .select({ id: tables.activeBuffs.id })
    .from(tables.activeBuffs)
    .where(
      and(
        eq(tables.activeBuffs.userId, input.userId),
        gt(tables.activeBuffs.expiresAt, new Date()),
      ),
    );

  if (existing) return null;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + config.durationMs);

  try {
    await db.insert(tables.activeBuffs).values({
      userId: input.userId,
      buffType: input.buffType,
      multiplier: config.multiplier,
      startedAt,
      expiresAt,
      // Kept as a legacy storage field so this change needs no production
      // migration. Point credits no longer read or enforce this value.
      capAmount: 0,
      sourcePurchaseId: input.sourcePurchaseId,
    });
  } catch (error) {
    const [replayed] = await db
      .select({
        buffType: tables.activeBuffs.buffType,
        multiplier: tables.activeBuffs.multiplier,
        expiresAt: tables.activeBuffs.expiresAt,
      })
      .from(tables.activeBuffs)
      .where(eq(tables.activeBuffs.sourcePurchaseId, input.sourcePurchaseId));
    if (replayed) return replayed;
    throw error;
  }

  return { buffType: input.buffType, multiplier: config.multiplier, expiresAt };
}

export async function buyBuff(
  input: { userId: string; ouid: string; item: keyof typeof BUFF_CONFIG },
  db: Db,
) {
  const config = BUFF_CONFIG[input.item];

  const [existing] = await db
    .select({ id: tables.activeBuffs.id })
    .from(tables.activeBuffs)
    .where(
      and(
        eq(tables.activeBuffs.userId, input.userId),
        gt(tables.activeBuffs.expiresAt, new Date()),
      ),
    );

  if (existing) {
    throw new Error("คุณมีบัฟที่ใช้งานอยู่แล้ว กรุณารอให้หมดอายุก่อน");
  }

  const [redemption] = await db
    .insert(tables.shopRedemptions)
    .values({ userId: input.userId, item: input.item, pointsCost: config.cost })
    .returning({ id: tables.shopRedemptions.id });
  if (!redemption) throw new Error("Failed to create redemption");

  await debitPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: config.cost,
    source: "shop_redeem",
    refId: redemption.id,
  });

  let buff;
  try {
    buff = await grantBuff(db, {
      userId: input.userId,
      buffType: input.item,
      sourcePurchaseId: redemption.id,
    });
  } catch (error) {
    await creditPoints(db, {
      userId: input.userId,
      ouid: input.ouid,
      amount: config.cost,
      source: "shop_refund",
      refId: redemption.id,
    });
    throw error;
  }
  if (!buff) {
    // Extremely rare TOCTOU: another request granted a buff between our
    // check above and now. Refund since we already charged for it.
    await creditPoints(db, {
      userId: input.userId,
      ouid: input.ouid,
      amount: config.cost,
      source: "shop_refund",
      refId: redemption.id,
    });
    throw new Error("คุณมีบัฟที่ใช้งานอยู่แล้ว กรุณารอให้หมดอายุก่อน");
  }

  return buff;
}

export async function buyTicket(
  input: { userId: string; ouid: string },
  db: Db,
) {
  const gameType =
    TICKETED_GAME_TYPES[
      Math.floor(Math.random() * TICKETED_GAME_TYPES.length)
    ]!;
  const redemptionId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();

  await debitPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: TICKET_COST,
    source: "shop_redeem",
    refId: redemptionId,
  });

  try {
    await db.batch([
      db.insert(tables.shopRedemptions).values({
        id: redemptionId,
        userId: input.userId,
        item: "minigame_ticket",
        pointsCost: TICKET_COST,
        resultRef: gameType,
      }),
      db.insert(tables.minigameTickets).values({
        id: ticketId,
        userId: input.userId,
        gameType,
        sourcePurchaseId: redemptionId,
        expiresAt: new Date(Date.now() + TICKET_EXPIRY_MS),
      }),
    ]);
  } catch (error) {
    await creditPoints(db, {
      userId: input.userId,
      ouid: input.ouid,
      amount: TICKET_COST,
      source: "shop_refund",
      refId: redemptionId,
    });
    throw error;
  }

  return { gameType, ticketId };
}
