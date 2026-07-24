import { eq, and, isNotNull, isNull, gt, lte, desc, sql } from "drizzle-orm";
import { tables, type Db, type Tx } from "@vidyafreshmen/db";
import type { groupPreferenceSchema } from "@vidyafreshmen/dto";
import type z from "zod/v4";
import { availableGroups, user } from '@vidyafreshmen/db/schemas';
import { creditPoints, getBalance } from "./points.service";

export type GroupLeaderboard = {
  groupNumber: string;
  totalScore: number;
  leaderboard: { playerId: string; playerName: string; score: number }[];
};

// Generous upper bound on physical human tap rate (two-thumb frantic
// tapping). Bounds accepted raw taps by server-observed elapsed time since
// this user's last accepted pop, same idiom as minigame/precision.ts trusting
// only its own clock - a scripted/held-down request loop can't claim more
// taps than could plausibly have happened between requests, regardless of
// what the client batches and reports.
const MAX_TAPS_PER_SECOND = 15;

// Single-use pop-session token TTL - generous relative to the ~5s client
// flush cadence so an occasional missed/delayed flush (backgrounded tab,
// network blip) doesn't strand the client without a usable token, while
// still bounding how long a leaked-but-unused token stays valid.
const POP_TOKEN_TTL_MS = 5 * 60 * 1000;

// Best-effort audit trail for pop-endpoint abuse signals (invalid/replayed
// token, elapsed-time throttle clamped a request). Not auto-punitive - just
// enough for staff to attribute suspicious score growth to a specific ouid
// after the fact. Logging must never break the actual gameplay path, so
// failures here are swallowed.
async function logAnomaly(db: Db, input: { userId: string; type: string; detail?: unknown }) {
  try {
    await db.insert(tables.anomalyEvents).values({
      userId: input.userId,
      type: input.type,
      detail: input.detail !== undefined ? JSON.stringify(input.detail) : null,
    });
  } catch (e) {
    console.error("[anti-cheat] failed to log anomaly event", e);
  }
}

// Issues the next single-use token in the chain - called both to bootstrap
// a fresh game session and after every accepted /pop request so the client
// always has a token ready for its next flush.
export async function issuePopToken(userId: string, db: Db) {
  const [row] = await db
    .insert(tables.popSessions)
    .values({ userId, expiresAt: new Date(Date.now() + POP_TOKEN_TTL_MS) })
    .returning({ token: tables.popSessions.token, expiresAt: tables.popSessions.expiresAt });
  return row!;
}

// Atomic conditional UPDATE is the whole validity gate (unused, unexpired,
// belongs to this user) - same idiom as minigame_plays.status. 0 rows back
// means the token was missing, already consumed (replay), expired, or
// someone else's - all treated identically as "invalid" to the caller so a
// scripted replay attempt learns nothing about which.
async function consumePopToken(userId: string, token: string, db: Db): Promise<boolean> {
  const updated = await db
    .update(tables.popSessions)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(tables.popSessions.token, token),
        eq(tables.popSessions.userId, userId),
        isNull(tables.popSessions.consumedAt),
        gt(tables.popSessions.expiresAt, new Date()),
      ),
    )
    .returning({ token: tables.popSessions.token });
  return updated.length > 0;
}

export type AddPopResult = { applied: number; nextToken: string };

// Unified with the shop/minigame/friends economy - there is only one score
// now (spendable points balance), not a separate raw pop count. Buffs,
// purchases, minigame wins and friend rewards all move the same number
// shown here and on the leaderboard below.
//
// Returns the amount actually credited (after the token check, the
// elapsed-time throttle, and creditPoints' own buff-cap accounting) plus the
// next chained token, so the caller can tell the client the truth instead of
// it optimistically guessing and silently correcting later.
export async function addPop(
  userId: string,
  ouid: string,
  requestedAmount: number,
  token: string,
  db: Db,
): Promise<AddPopResult> {
  const tokenValid = await consumePopToken(userId, token, db);
  if (!tokenValid) {
    await logAnomaly(db, { userId, type: "pop_token_invalid", detail: { token } });
    throw new Error("เซสชันหมดอายุ กรุณาลองใหม่อีกครั้ง");
  }

  const now = new Date();

  const [existing] = await db
    .select({ lastPopAt: tables.popRateLimits.lastPopAt })
    .from(tables.popRateLimits)
    .where(eq(tables.popRateLimits.userId, userId));

  const lastPopAt = existing?.lastPopAt ?? null;
  const elapsedMs = lastPopAt ? now.getTime() - lastPopAt.getTime() : Number.MAX_SAFE_INTEGER;
  const maxAllowed = Math.max(0, Math.ceil((elapsedMs / 1000) * MAX_TAPS_PER_SECOND));
  const allowedAmount = Math.min(requestedAmount, maxAllowed);

  if (allowedAmount < requestedAmount) {
    await logAnomaly(db, {
      userId,
      type: "pop_rate_clamped",
      detail: { requestedAmount, allowedAmount, elapsedMs },
    });
  }

  if (allowedAmount <= 0) {
    const { token: nextToken } = await issuePopToken(userId, db);
    return { applied: 0, nextToken };
  }

  // Optimistic lock on lastPopAt, same pattern as creditPoints' buff update -
  // if a concurrent request from the same user already consumed this window
  // since we read it, back off to crediting nothing rather than risk two
  // requests both spending the same elapsed-time allowance.
  const updated = await db
    .insert(tables.popRateLimits)
    .values({ userId, lastPopAt: now })
    .onConflictDoUpdate({
      target: tables.popRateLimits.userId,
      set: { lastPopAt: now },
      setWhere: lastPopAt ? eq(tables.popRateLimits.lastPopAt, lastPopAt) : undefined,
    })
    .returning({ userId: tables.popRateLimits.userId });

  const { token: nextToken } = await issuePopToken(userId, db);

  if (updated.length === 0) {
    return { applied: 0, nextToken };
  }

  const applied = await creditPoints(db, { userId, ouid, amount: allowedAmount, source: "shake_pop" });
  return { applied, nextToken };
}

export async function getSelfScore(userId: string, db: Db | Tx) {
  return getBalance(userId, db as Db);
}

// Row count here is a few hundred students for the whole event - grouping in
// JS instead of a per-group-top-N SQL query keeps this simple and is trivial
// at this scale.
export async function getLeaderboard(db: Db | Tx): Promise<GroupLeaderboard[]> {
  const rows = await db
    .select({
      playerId: user.id,
      groupNumber: user.group,
      score: tables.pointsBalances.balance,
      playerName: user.name,
    })
    .from(tables.pointsBalances)
    .innerJoin(user, eq(user.id, tables.pointsBalances.userId))
    .where(isNotNull(user.group))
    .orderBy(desc(tables.pointsBalances.balance));

  const byGroup = new Map<string, { playerId: string; playerName: string; score: number }[]>();
  for (const row of rows) {
    const groupNumber = row.groupNumber!;
    const entries = byGroup.get(groupNumber) ?? [];
    entries.push({ playerId: row.playerId, playerName: row.playerName, score: row.score });
    byGroup.set(groupNumber, entries);
  }

  return Array.from(byGroup.entries())
    .map(([groupNumber, entries]) => ({
      groupNumber,
      totalScore: entries.reduce((sum, entry) => sum + entry.score, 0),
      leaderboard: entries.slice(0, 10),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

export type DailyTopPlayer = {
  playerId: string;
  playerName: string;
  ouid: string | null;
  groupNumber: string;
  score: number;
};

// Cumulative score as of an arbitrary point in time, summed straight from
// points_ledger (the append-only event log) rather than the materialized
// pointsBalances table (which only ever holds the *current* total) - so the
// staff-only daily cutoff leaderboard (packages/flags' dailyLeaderboardCutoffs)
// needs no separate snapshot job, since every credit is already timestamped.
export async function getDailyTop10(cutoffAt: Date, db: Db | Tx): Promise<DailyTopPlayer[]> {
  const scoreSum = sql<number>`sum(${tables.pointsLedger.delta})`;

  const rows = await db
    .select({
      playerId: user.id,
      playerName: user.name,
      ouid: user.ouid,
      groupNumber: user.group,
      score: scoreSum.as("score"),
    })
    .from(tables.pointsLedger)
    .innerJoin(user, eq(user.id, tables.pointsLedger.userId))
    .where(and(isNotNull(user.group), lte(tables.pointsLedger.createdAt, cutoffAt)))
    .groupBy(user.id)
    .orderBy(desc(scoreSum))
    .limit(10);

  return rows.map((row) => ({ ...row, groupNumber: row.groupNumber! }));
}

export async function updateUserGroup(email: string, groupCode: string, db: Db | Tx) {
  const studentUser = await db.query.user.findFirst({
    where: eq(user?.email, email),
  })

  if (studentUser?.group) {
    throw new Error("คุณมีกลุ่มอยู่แล้ว");
  }

  const group = await db.query.availableGroups.findFirst({
    where: eq(availableGroups.joinGroupPassword, groupCode),
  })

  if (!group) {
    throw new Error("ไม่พบกลุ่มนี้")
  }

  await db
    .update(user)
    .set({
      group: group.number
    })
    .where(eq(user.email, email))
}
