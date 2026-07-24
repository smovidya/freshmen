import { and, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { TICKETED_GAME_TYPES } from "@vidyafreshmen/dto";

// Auto-pops a free bonus minigame the first time a user's balance reaches or
// crosses each of these totals - see checkMilestones below. Fixed by the
// organizer's ask, not derived from anything else.
const SCORE_MILESTONES = [67, 676, 6767];

// One structured JSON line per game economy transaction (every credit/debit
// through this file - pops, shop purchases, minigame wins, friend rewards,
// free claims - since they all funnel through creditPoints/debitPoints).
// Cloudflare Workers Observability captures console.log output automatically
// and indexes top-level JSON keys as filterable/queryable attributes in the
// Logs dashboard - no extra SDK or binding needed, this is the whole
// integration. Keep this the single call site so every transaction type gets
// logged uniformly rather than sprinkling console.log across every caller.
function logTransaction(event: "points_credit" | "points_debit", attrs: Record<string, unknown>) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...attrs }));
}

// NOTE: D1 does not support drizzle's db.transaction() - the underlying
// binding rejects BEGIN/SAVEPOINT at runtime ("please use
// state.storage.transaction() instead"). Every function here is built from
// a sequence of independently-atomic single statements instead: each
// mutation that must be exactly-once or exactly-conditional uses a
// conditional UPDATE/INSERT ... WHERE ... RETURNING as its own atomicity
// gate (0 rows back = guard failed, safe to bail out), same idiom the rest
// of this codebase already relies on (e.g. game.service.ts's onConflictDoUpdate
// upserts) rather than cross-statement rollback.

export type CreditInput = {
  userId: string;
  ouid: string;
  amount: number;
  source: string;
  refId?: string;
};

// Core shared credit path - every point-earning action (shake pops, minigame
// wins, friend rewards) goes through this so the active-buff multiplier and
// idempotency guard apply uniformly. Returns the amount actually applied
// (0 if this (source, refId) was already credited before - safe to call
// again on a client retry).
//
// Idempotency claim happens FIRST, via a placeholder (delta: 0) ledger row
// inserted with onConflictDoNothing - that single atomic INSERT is what
// decides "new event or duplicate", before active_buffs is touched at all.
// A retried/duplicate (source, refId) loses that race, returns 0 immediately,
// and never mutates grantedAmount - only the confirmed-unique winner
// continues on to compute the buff-multiplied amount and back-fill this
// row's real delta. (Previously the buff update ran before this check, so a
// retry could consume buff cap headroom for a credit that then got rejected
// as a duplicate - balance/buff drift with no corresponding real credit.)
export async function creditPoints(db: Db, input: CreditInput): Promise<number> {
  const claimed = await db
    .insert(tables.pointsLedger)
    .values({
      userId: input.userId,
      ouid: input.ouid,
      delta: 0,
      source: input.source,
      refId: input.refId ?? null,
    })
    .onConflictDoNothing({ target: [tables.pointsLedger.source, tables.pointsLedger.refId] })
    .returning({ id: tables.pointsLedger.id });

  if (claimed.length === 0) {
    // Already credited for this (source, refId) - client retry, no-op.
    logTransaction("points_credit", {
      userId: input.userId,
      ouid: input.ouid,
      source: input.source,
      refId: input.refId ?? null,
      requestedAmount: input.amount,
      appliedAmount: 0,
      duplicate: true,
    });
    return 0;
  }
  const ledgerRowId = claimed[0]!.id;

  const [buff] = await db
    .select()
    .from(tables.activeBuffs)
    .where(and(eq(tables.activeBuffs.userId, input.userId), gt(tables.activeBuffs.expiresAt, new Date())));

  let applied = input.amount;
  if (buff && buff.grantedAmount < buff.capAmount) {
    applied = Math.min(input.amount * buff.multiplier, buff.capAmount - buff.grantedAmount);
    // Optimistic lock on grantedAmount - if another concurrent credit already
    // moved it since we read it, back off to unbuffered rather than risk a
    // lost update (double-applying the multiplier headroom).
    const updated = await db
      .update(tables.activeBuffs)
      .set({ grantedAmount: buff.grantedAmount + applied })
      .where(and(eq(tables.activeBuffs.id, buff.id), eq(tables.activeBuffs.grantedAmount, buff.grantedAmount)))
      .returning({ id: tables.activeBuffs.id });
    if (updated.length === 0) applied = input.amount;
  }

  const before = await getBalance(input.userId, db);

  await db.update(tables.pointsLedger).set({ delta: applied }).where(eq(tables.pointsLedger.id, ledgerRowId));

  await db
    .insert(tables.pointsBalances)
    .values({ userId: input.userId, balance: applied })
    .onConflictDoUpdate({
      target: tables.pointsBalances.userId,
      set: {
        balance: sql`${tables.pointsBalances.balance} + ${applied}`,
        updatedAt: new Date(),
      },
    });

  if (applied > 0) {
    await checkMilestones(db, { userId: input.userId, after: before + applied });
  }

  logTransaction("points_credit", {
    userId: input.userId,
    ouid: input.ouid,
    source: input.source,
    refId: input.refId ?? null,
    requestedAmount: input.amount,
    appliedAmount: applied,
    duplicate: false,
    buffMultiplier: buff ? buff.multiplier : null,
    balanceBefore: before,
    balanceAfter: before + applied,
  });

  return applied;
}

// Fires once per user per threshold - grants a free ticket for a random
// ticketed minigame the moment a credit leaves the balance at or above 67 /
// 676 / 6767. Deliberately NOT gated on "crossed from below this time" - a
// user whose balance was already past a threshold before this feature (or
// this specific threshold) existed would otherwise never trigger it again,
// since they'd never "cross" it a second time. onConflictDoNothing on
// (userId, threshold) is the sole "already triggered" guard (so it still
// only ever fires once per user per threshold, whichever credit happens to
// be the first to notice); the client polls claimPendingMilestones to
// auto-open the granted game.
async function checkMilestones(db: Db, input: { userId: string; after: number }) {
  for (const threshold of SCORE_MILESTONES) {
    if (input.after < threshold) continue;

    const gameType = TICKETED_GAME_TYPES[Math.floor(Math.random() * TICKETED_GAME_TYPES.length)]!;
    const [trigger] = await db
      .insert(tables.milestoneTriggers)
      .values({ userId: input.userId, threshold, gameType })
      .onConflictDoNothing({ target: [tables.milestoneTriggers.userId, tables.milestoneTriggers.threshold] })
      .returning({ id: tables.milestoneTriggers.id });

    if (!trigger) continue;

    await db.insert(tables.minigameTickets).values({
      userId: input.userId,
      gameType,
      sourcePurchaseId: trigger.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }
}

export async function claimPendingMilestones(userId: string, db: Db) {
  return db
    .update(tables.milestoneTriggers)
    .set({ notifiedAt: new Date() })
    .where(and(eq(tables.milestoneTriggers.userId, userId), isNull(tables.milestoneTriggers.notifiedAt)))
    .returning({
      id: tables.milestoneTriggers.id,
      threshold: tables.milestoneTriggers.threshold,
      gameType: tables.milestoneTriggers.gameType,
    });
}

export type DebitInput = {
  userId: string;
  ouid: string;
  amount: number;
  source: string;
  refId?: string;
};

// Buff multiplier never applies to spending - only to earning. The
// idempotency insert happens first (cheap, always safe to attempt), then a
// single conditional UPDATE does the affordability check + decrement
// atomically (WHERE balance >= amount) - if that guard fails we compensate
// by deleting the ledger row we just inserted, since there's no transaction
// to roll it back for us.
export async function debitPoints(db: Db, input: DebitInput): Promise<void> {
  const inserted = await db
    .insert(tables.pointsLedger)
    .values({
      userId: input.userId,
      ouid: input.ouid,
      delta: -input.amount,
      source: input.source,
      refId: input.refId ?? null,
    })
    .onConflictDoNothing({ target: [tables.pointsLedger.source, tables.pointsLedger.refId] })
    .returning({ id: tables.pointsLedger.id });

  if (inserted.length === 0) {
    logTransaction("points_debit", {
      userId: input.userId,
      ouid: input.ouid,
      source: input.source,
      refId: input.refId ?? null,
      requestedAmount: input.amount,
      duplicate: true,
      rejected: false,
    });
    throw new Error("รายการนี้ถูกดำเนินการไปแล้ว");
  }

  const updated = await db
    .update(tables.pointsBalances)
    .set({
      balance: sql`${tables.pointsBalances.balance} - ${input.amount}`,
      updatedAt: new Date(),
    })
    .where(and(eq(tables.pointsBalances.userId, input.userId), gte(tables.pointsBalances.balance, input.amount)))
    .returning({ id: tables.pointsBalances.userId, balance: tables.pointsBalances.balance });

  if (updated.length === 0) {
    await db.delete(tables.pointsLedger).where(eq(tables.pointsLedger.id, inserted[0]!.id));
    logTransaction("points_debit", {
      userId: input.userId,
      ouid: input.ouid,
      source: input.source,
      refId: input.refId ?? null,
      requestedAmount: input.amount,
      duplicate: false,
      rejected: true,
      rejectReason: "insufficient_balance",
    });
    throw new Error("แต้มไม่พอ");
  }

  logTransaction("points_debit", {
    userId: input.userId,
    ouid: input.ouid,
    source: input.source,
    refId: input.refId ?? null,
    requestedAmount: input.amount,
    duplicate: false,
    rejected: false,
    balanceAfter: updated[0]!.balance,
    balanceBefore: updated[0]!.balance + input.amount,
  });
}

export async function getBalance(userId: string, db: Db) {
  const [row] = await db
    .select({ balance: tables.pointsBalances.balance })
    .from(tables.pointsBalances)
    .where(eq(tables.pointsBalances.userId, userId));
  return row?.balance ?? 0;
}

export const FREE_CLAIM_AMOUNT = 500;
export const FREE_CLAIM_INTERVAL_MS = 3 * 60 * 60 * 1000;

export async function getClaimStatus(userId: string, db: Db) {
  const [row] = await db
    .select({ lastClaimedAt: tables.freeClaims.lastClaimedAt })
    .from(tables.freeClaims)
    .where(eq(tables.freeClaims.userId, userId));

  const lastClaimedAt = row?.lastClaimedAt ?? null;
  // No row / never claimed = eligible right now (first-access freebie).
  const nextClaimAt = lastClaimedAt ? new Date(lastClaimedAt.getTime() + FREE_CLAIM_INTERVAL_MS) : null;
  const available = !nextClaimAt || nextClaimAt.getTime() <= Date.now();

  return {
    available,
    nextClaimAt: available ? null : nextClaimAt,
    amount: FREE_CLAIM_AMOUNT,
    intervalMs: FREE_CLAIM_INTERVAL_MS,
  };
}

// Single UPSERT is the whole atomicity gate: first-ever claim (no row) always
// inserts; a repeat claim only overwrites lastClaimedAt if the conflict
// update's WHERE passes (null or past the interval) - SQLite skips the
// update entirely otherwise, so RETURNING comes back empty and we know the
// claim was too early. No separate "check cooldown" step needed/possible to
// race around.
export async function claimFreePoints(input: { userId: string; ouid: string }, db: Db) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - FREE_CLAIM_INTERVAL_MS);

  const claimed = await db
    .insert(tables.freeClaims)
    .values({ userId: input.userId, lastClaimedAt: now })
    .onConflictDoUpdate({
      target: tables.freeClaims.userId,
      set: { lastClaimedAt: now },
      setWhere: or(isNull(tables.freeClaims.lastClaimedAt), lte(tables.freeClaims.lastClaimedAt, cutoff)),
    })
    .returning({ userId: tables.freeClaims.userId });

  if (claimed.length === 0) {
    throw new Error("ยังไม่ถึงเวลารับแต้มฟรีรอบถัดไป");
  }

  await creditPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: FREE_CLAIM_AMOUNT,
    source: "free_claim",
    refId: now.toISOString(),
  });

  return { amount: FREE_CLAIM_AMOUNT };
}

export async function getActiveBuff(userId: string, db: Db) {
  const [buff] = await db
    .select()
    .from(tables.activeBuffs)
    .where(and(eq(tables.activeBuffs.userId, userId), gt(tables.activeBuffs.expiresAt, new Date())));

  if (!buff) return null;

  return {
    buffType: buff.buffType,
    multiplier: buff.multiplier,
    expiresAt: buff.expiresAt,
    grantedAmount: buff.grantedAmount,
    capAmount: buff.capAmount,
  };
}
