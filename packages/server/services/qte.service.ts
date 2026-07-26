import { and, eq, gt, lte } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { TICKETED_GAME_TYPES } from "@vidyafreshmen/dto";

// Visible countdown window client-side is 30s - a little slack on top so a
// slow network round-trip on claim doesn't strand a user who tapped in time.
const QTE_SESSION_WINDOW_MS = 35 * 1000;

// The client schedules its own popup on a 20-minute timer, but that's not
// what actually enforces the cadence - a scripted client could just call
// schedule+claim in a loop. This server-side "not sooner than N minutes
// since your last session" check is the real guard; 19 minutes (not 20)
// leaves a small margin so an honest client's timer jitter never gets
// rejected by its own server.
const QTE_MIN_INTERVAL_MS = 19 * 60 * 1000;

export type QteSession = { id: string; expiresAt: Date };

// Atomic cadence gate: a single UPSERT on qte_schedule_limits (one row per
// user) replaces what used to be a SELECT-most-recent-session-then-INSERT
// check. That older shape was raceable - N concurrent schedule calls could
// all read "no recent session" before any of them committed, each minting
// its own free-ticket-bearing session. Here, the conflict-update's WHERE
// clause is evaluated against whatever the winning concurrent writer actually
// committed (never a stale read), so at most one caller per QTE_MIN_INTERVAL_MS
// window ever proceeds to create a session, at any concurrency level.
async function tryConsumeQteCooldown(userId: string, db: Db): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - QTE_MIN_INTERVAL_MS);
  const claimed = await db
    .insert(tables.qteScheduleLimits)
    .values({ userId, lastScheduledAt: now })
    .onConflictDoUpdate({
      target: tables.qteScheduleLimits.userId,
      set: { lastScheduledAt: now },
      setWhere: lte(tables.qteScheduleLimits.lastScheduledAt, cutoff),
    })
    .returning({ userId: tables.qteScheduleLimits.userId });
  return claimed.length > 0;
}

export async function scheduleQte(userId: string, db: Db): Promise<QteSession> {
  if (!(await tryConsumeQteCooldown(userId, db))) {
    throw new Error("ยังไม่ถึงเวลาของกิจกรรมพิเศษรอบถัดไป");
  }

  const expiresAt = new Date(Date.now() + QTE_SESSION_WINDOW_MS);
  const [session] = await db
    .insert(tables.qteSessions)
    .values({ userId, expiresAt })
    .returning({
      id: tables.qteSessions.id,
      expiresAt: tables.qteSessions.expiresAt,
    });

  return session!;
}

// The read validates ownership and expiry; the D1 batch below commits the
// claimed status and ticket together. sourcePurchaseId makes a lost response
// replay-safe without granting a second ticket.
export async function claimQte(
  input: { userId: string; sessionId: string },
  db: Db,
) {
  const sourcePurchaseId = `qte-${input.sessionId}`;
  const [replayedTicket] = await db
    .select({ gameType: tables.minigameTickets.gameType })
    .from(tables.minigameTickets)
    .where(eq(tables.minigameTickets.sourcePurchaseId, sourcePurchaseId));
  if (replayedTicket) return { gameType: replayedTicket.gameType };

  const [session] = await db
    .select({ id: tables.qteSessions.id })
    .from(tables.qteSessions)
    .where(
      and(
        eq(tables.qteSessions.id, input.sessionId),
        eq(tables.qteSessions.userId, input.userId),
        eq(tables.qteSessions.status, "pending"),
        gt(tables.qteSessions.expiresAt, new Date()),
      ),
    );

  if (!session) {
    throw new Error("หมดเวลาแล้ว ลองรอบถัดไปนะ");
  }

  const gameType =
    TICKETED_GAME_TYPES[
      Math.floor(Math.random() * TICKETED_GAME_TYPES.length)
    ]!;
  try {
    await db.batch([
      db
        .update(tables.qteSessions)
        .set({ status: "claimed" })
        .where(
          and(
            eq(tables.qteSessions.id, input.sessionId),
            eq(tables.qteSessions.userId, input.userId),
            eq(tables.qteSessions.status, "pending"),
            gt(tables.qteSessions.expiresAt, new Date()),
          ),
        ),
      db.insert(tables.minigameTickets).values({
        userId: input.userId,
        gameType,
        sourcePurchaseId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }),
    ]);
  } catch (error) {
    const [wonRace] = await db
      .select({ gameType: tables.minigameTickets.gameType })
      .from(tables.minigameTickets)
      .where(eq(tables.minigameTickets.sourcePurchaseId, sourcePurchaseId));
    if (wonRace) return { gameType: wonRace.gameType };
    throw error;
  }
  return { gameType };
}
