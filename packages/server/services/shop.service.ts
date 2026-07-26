import { and, eq, gt, lt, lte, sql } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { TICKETED_GAME_TYPES } from "@vidyafreshmen/dto";
import { startOfBangkokDay } from "./minigame/mystery-box";
import { creditPoints, debitPoints } from "./points.service";

// Minimum gap between any two shop actions (buy buff, buy ticket) from the
// same user. The client's "busy" flag only stops double-clicking in a real
// browser - a scripted client can fire requests as fast as it wants, so this
// server-side cooldown is the actual guard. Single atomic UPSERT (same
// setWhere idiom as points.service.ts's claimFreePoints), so no number of
// concurrent requests can slip through: SQLite/D1 serializes conflicting
// writes to the same primary key, and only one of them sees a lastActionAt
// old enough to pass.
const SHOP_ACTION_COOLDOWN_MS = 800;

async function tryConsumeShopCooldown(userId: string, db: Db): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - SHOP_ACTION_COOLDOWN_MS);
  const updated = await db
    .insert(tables.shopRateLimits)
    .values({ userId, lastActionAt: now })
    .onConflictDoUpdate({
      target: tables.shopRateLimits.userId,
      set: { lastActionAt: now },
      setWhere: lte(tables.shopRateLimits.lastActionAt, cutoff),
    })
    .returning({ userId: tables.shopRateLimits.userId });
  return updated.length > 0;
}

// Atomically claims one of `limit` daily slots for (userId, item) - the
// RETURNING row count *is* the pass/fail signal, decided in one statement.
// Unlike a separate COUNT-then-INSERT check, this can't be raced: the first
// concurrent writer for a given day either inserts the row or wins the
// conflict-update race, and every other concurrent writer's UPDATE is gated
// by setWhere against the count that writer actually committed - never a
// stale read. day is a Bangkok-calendar date string, so a new day is just a
// new row (no reset job needed).
async function tryConsumeDailyLimit(input: { userId: string; item: string; limit: number }, db: Db): Promise<boolean> {
  const day = startOfBangkokDay().toISOString().slice(0, 10);
  const claimed = await db
    .insert(tables.shopDailyLimits)
    .values({ userId: input.userId, item: input.item, day, count: 1 })
    .onConflictDoUpdate({
      target: [tables.shopDailyLimits.userId, tables.shopDailyLimits.item, tables.shopDailyLimits.day],
      set: { count: sql`${tables.shopDailyLimits.count} + 1` },
      setWhere: lt(tables.shopDailyLimits.count, input.limit),
    })
    .returning({ count: tables.shopDailyLimits.count });
  return claimed.length > 0;
}

// D1 batch() is transactional. Fixed write sets use it directly; flows that
// cross the shared point service retain idempotent compensation so a retry
// cannot charge twice or strand a purchase.

// "buff_x100" is a legacy key (stored in active_buffs.buffType and pending
// wheel plays) - it now grants x50, retuned after the score-inflation
// incident. Buffs multiply shake pops only (see creditPoints /
// BUFF_ELIGIBLE_SOURCES), so a 10s x50 is bounded by physical tap rate, not
// by minigame jackpots.
export const BUFF_CONFIG = {
  buff_x3: { cost: 300, multiplier: 3, durationMs: 30_000 },
  buff_x100: { cost: 1000, multiplier: 50, durationMs: 10_000 },
} as const;

// Close to the wheel's direct-point expected value, so a paid random play is
// entertainment rather than a disguised 500-point penalty.
export const TICKET_COST = 150;
export const TICKET_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Per-user daily purchase cap (Bangkok day). The ticket loop is profitable
// for a scripted player (max minigame rewards exceed TICKET_COST), so without
// a cap it's an infinite score pump - this bounds it linearly per day.
// Milestone/QTE free tickets don't go through buyTicket and are uncounted.
export const TICKET_DAILY_LIMIT = 20;

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
  if (!(await tryConsumeShopCooldown(input.userId, db))) {
    throw new Error("กดเร็วไปหน่อย รอสักครู่แล้วลองใหม่");
  }

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
  if (!(await tryConsumeShopCooldown(input.userId, db))) {
    throw new Error("กดเร็วไปหน่อย รอสักครู่แล้วลองใหม่");
  }

  // Atomic slot claim - see tryConsumeDailyLimit's comment. A rejected claim
  // here never touched shopRedemptions or debited anything, so a spamming
  // client just gets the same error repeatedly, never more tickets than
  // TICKET_DAILY_LIMIT.
  if (!(await tryConsumeDailyLimit({ userId: input.userId, item: "minigame_ticket", limit: TICKET_DAILY_LIMIT }, db))) {
    throw new Error(`ซื้อตั๋วได้สูงสุด ${TICKET_DAILY_LIMIT} ใบต่อวัน วันนี้ครบแล้ว พรุ่งนี้มาใหม่นะ`);
  }

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
