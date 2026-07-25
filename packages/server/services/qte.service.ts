import { and, desc, eq, gt } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { TICKETED_GAME_TYPES } from "@vidyafreshmen/dto";
import { grantFreeTicket } from "./minigame/tickets";

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

export async function scheduleQte(userId: string, db: Db): Promise<QteSession> {
  const [recent] = await db
    .select({ createdAt: tables.qteSessions.createdAt })
    .from(tables.qteSessions)
    .where(eq(tables.qteSessions.userId, userId))
    .orderBy(desc(tables.qteSessions.createdAt))
    .limit(1);

  if (recent && Date.now() - recent.createdAt.getTime() < QTE_MIN_INTERVAL_MS) {
    throw new Error("ยังไม่ถึงเวลาของกิจกรรมพิเศษรอบถัดไป");
  }

  const expiresAt = new Date(Date.now() + QTE_SESSION_WINDOW_MS);
  const [session] = await db
    .insert(tables.qteSessions)
    .values({ userId, expiresAt })
    .returning({ id: tables.qteSessions.id, expiresAt: tables.qteSessions.expiresAt });

  return session!;
}

// D1 has no transactions - the conditional UPDATE below is the entire
// validity gate (belongs to this user, still pending, not expired). Zero
// rows back covers "already claimed", "expired", and "never existed"
// identically, same idiom as minigame_tickets/minigame_plays elsewhere.
export async function claimQte(input: { userId: string; sessionId: string }, db: Db) {
  const updated = await db
    .update(tables.qteSessions)
    .set({ status: "claimed" })
    .where(
      and(
        eq(tables.qteSessions.id, input.sessionId),
        eq(tables.qteSessions.userId, input.userId),
        eq(tables.qteSessions.status, "pending"),
        gt(tables.qteSessions.expiresAt, new Date()),
      ),
    )
    .returning({ id: tables.qteSessions.id });

  if (updated.length === 0) {
    throw new Error("หมดเวลาแล้ว ลองรอบถัดไปนะ");
  }

  const gameType = TICKETED_GAME_TYPES[Math.floor(Math.random() * TICKETED_GAME_TYPES.length)]!;
  await grantFreeTicket(input.userId, gameType, db);
  return { gameType };
}
