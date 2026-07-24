import { and, eq, gt } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { TICKETED_GAME_TYPES } from "@vidyafreshmen/dto";
import { creditPoints, debitPoints } from "./points.service";

// See points.service.ts's header note: D1 has no real transaction support,
// so every multi-step flow here is a sequence of independently-atomic
// statements with compensating actions on failure, not a rollback block.

export const BUFF_CONFIG = {
  buff_x3: { cost: 300, multiplier: 3, durationMs: 30_000, cap: 450 },
  buff_x100: { cost: 1000, multiplier: 100, durationMs: 10_000, cap: 5000 },
} as const;

export const TICKET_COST = 500;
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
  input: { userId: string; buffType: keyof typeof BUFF_CONFIG; sourcePurchaseId: string },
) {
  const config = BUFF_CONFIG[input.buffType];

  const [existing] = await db
    .select({ id: tables.activeBuffs.id })
    .from(tables.activeBuffs)
    .where(and(eq(tables.activeBuffs.userId, input.userId), gt(tables.activeBuffs.expiresAt, new Date())));

  if (existing) return null;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + config.durationMs);

  await db.insert(tables.activeBuffs).values({
    userId: input.userId,
    buffType: input.buffType,
    multiplier: config.multiplier,
    startedAt,
    expiresAt,
    capAmount: config.cap,
    sourcePurchaseId: input.sourcePurchaseId,
  });

  return { buffType: input.buffType, multiplier: config.multiplier, expiresAt, capAmount: config.cap };
}

export async function buyBuff(
  input: { userId: string; ouid: string; item: keyof typeof BUFF_CONFIG },
  db: Db,
) {
  const config = BUFF_CONFIG[input.item];

  const [existing] = await db
    .select({ id: tables.activeBuffs.id })
    .from(tables.activeBuffs)
    .where(and(eq(tables.activeBuffs.userId, input.userId), gt(tables.activeBuffs.expiresAt, new Date())));

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

  const buff = await grantBuff(db, { userId: input.userId, buffType: input.item, sourcePurchaseId: redemption.id });
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

export async function buyTicket(input: { userId: string; ouid: string }, db: Db) {
  const gameType = TICKETED_GAME_TYPES[Math.floor(Math.random() * TICKETED_GAME_TYPES.length)]!;

  const [redemption] = await db
    .insert(tables.shopRedemptions)
    .values({ userId: input.userId, item: "minigame_ticket", pointsCost: TICKET_COST, resultRef: gameType })
    .returning({ id: tables.shopRedemptions.id });
  if (!redemption) throw new Error("Failed to create redemption");

  await debitPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: TICKET_COST,
    source: "shop_redeem",
    refId: redemption.id,
  });

  const [ticket] = await db
    .insert(tables.minigameTickets)
    .values({
      userId: input.userId,
      gameType,
      sourcePurchaseId: redemption.id,
      expiresAt: new Date(Date.now() + TICKET_EXPIRY_MS),
    })
    .returning({ id: tables.minigameTickets.id });
  if (!ticket) throw new Error("Failed to create ticket");

  return { gameType, ticketId: ticket.id };
}
