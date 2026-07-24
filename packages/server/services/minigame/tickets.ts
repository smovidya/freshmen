import { and, eq, gt } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";

// Ticket is consumed atomically the moment a game is started (not at
// submit) - this is the single point where "do you get to play" is decided,
// so a user can never start two attempts off one ticket (the conditional
// UPDATE only succeeds once, same idempotency shape as playToken elsewhere).
export async function consumeTicket(userId: string, gameType: string, db: Db): Promise<string> {
  const [ticket] = await db
    .select({ id: tables.minigameTickets.id })
    .from(tables.minigameTickets)
    .where(
      and(
        eq(tables.minigameTickets.userId, userId),
        eq(tables.minigameTickets.gameType, gameType),
        eq(tables.minigameTickets.status, "unused"),
        gt(tables.minigameTickets.expiresAt, new Date()),
      ),
    );

  if (!ticket) {
    throw new Error("ไม่มีตั๋วสำหรับเกมนี้ กรุณาซื้อตั๋วจากร้านค้า");
  }

  const updated = await db
    .update(tables.minigameTickets)
    .set({ status: "used", usedAt: new Date() })
    .where(and(eq(tables.minigameTickets.id, ticket.id), eq(tables.minigameTickets.status, "unused")))
    .returning({ id: tables.minigameTickets.id });

  if (updated.length === 0) {
    throw new Error("ตั๋วนี้ถูกใช้ไปแล้ว");
  }

  return ticket.id;
}

export async function listUnusedTickets(userId: string, db: Db) {
  return db
    .select({
      id: tables.minigameTickets.id,
      gameType: tables.minigameTickets.gameType,
      createdAt: tables.minigameTickets.createdAt,
      expiresAt: tables.minigameTickets.expiresAt,
    })
    .from(tables.minigameTickets)
    .where(
      and(
        eq(tables.minigameTickets.userId, userId),
        eq(tables.minigameTickets.status, "unused"),
        gt(tables.minigameTickets.expiresAt, new Date()),
      ),
    )
    .orderBy(tables.minigameTickets.createdAt);
}
