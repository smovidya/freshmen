import { and, eq, gt, inArray } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { TICKETED_GAME_TYPES } from "@vidyafreshmen/dto";

type TicketedGameType = (typeof TICKETED_GAME_TYPES)[number];

type TicketedPlayInput = {
  userId: string;
  gameType: TicketedGameType;
  playToken: string;
  serverState: string;
  status?: string;
  resultPayload?: string;
  pointsAwarded?: number;
  submittedAt?: Date;
};

// Creates the play and consumes its ticket in one D1 batch transaction. The
// client-generated playToken makes start requests replay-safe: if the response
// is lost, sending the same token returns the existing play instead of burning
// a second ticket. uniq_minigame_plays_ticket makes concurrent starts race
// safely; one batch wins and the other rolls back.
export async function startTicketedPlay(input: TicketedPlayInput, db: Db) {
  const [existing] = await db
    .select({
      id: tables.minigamePlays.id,
      gameType: tables.minigamePlays.gameType,
      playToken: tables.minigamePlays.playToken,
      status: tables.minigamePlays.status,
      serverState: tables.minigamePlays.serverState,
      resultPayload: tables.minigamePlays.resultPayload,
      pointsAwarded: tables.minigamePlays.pointsAwarded,
    })
    .from(tables.minigamePlays)
    .where(
      and(
        eq(tables.minigamePlays.userId, input.userId),
        eq(tables.minigamePlays.playToken, input.playToken),
      ),
    );

  if (existing) {
    if (existing.gameType !== input.gameType) {
      throw new Error("รหัสการเล่นนี้ถูกใช้กับเกมอื่นแล้ว");
    }
    return existing;
  }

  const [ticket] = await db
    .select({ id: tables.minigameTickets.id })
    .from(tables.minigameTickets)
    .where(
      and(
        eq(tables.minigameTickets.userId, input.userId),
        eq(tables.minigameTickets.gameType, input.gameType),
        eq(tables.minigameTickets.status, "unused"),
        gt(tables.minigameTickets.expiresAt, new Date()),
      ),
    );

  if (!ticket) {
    throw new Error("ไม่มีตั๋วสำหรับเกมนี้ กรุณาซื้อตั๋วจากร้านค้า");
  }

  const playId = crypto.randomUUID();
  const now = new Date();
  try {
    await db.batch([
      db.insert(tables.minigamePlays).values({
        id: playId,
        userId: input.userId,
        gameType: input.gameType,
        ticketId: ticket.id,
        playToken: input.playToken,
        status: input.status ?? "started",
        serverState: input.serverState,
        resultPayload: input.resultPayload,
        pointsAwarded: input.pointsAwarded,
        submittedAt: input.submittedAt,
      }),
      db
        .update(tables.minigameTickets)
        .set({ status: "used", usedAt: now })
        .where(
          and(
            eq(tables.minigameTickets.id, ticket.id),
            eq(tables.minigameTickets.status, "unused"),
          ),
        ),
    ]);
  } catch (error) {
    // A retry may have won the race and committed the same playToken.
    const [replayed] = await db
      .select()
      .from(tables.minigamePlays)
      .where(
        and(
          eq(tables.minigamePlays.userId, input.userId),
          eq(tables.minigamePlays.playToken, input.playToken),
          eq(tables.minigamePlays.gameType, input.gameType),
        ),
      );
    if (replayed) return replayed;
    throw error;
  }

  return {
    id: playId,
    gameType: input.gameType,
    playToken: input.playToken,
    status: input.status ?? "started",
    serverState: input.serverState,
    resultPayload: input.resultPayload ?? null,
    pointsAwarded: input.pointsAwarded ?? null,
  };
}

// Dev/staging only (gated by isProduction in the router, not here) - lets the
// dev toolbar jump straight into any ticketed minigame without going through
// the shop purchase flow. Short expiry since it's only ever meant to be
// consumed by the very next start() call.
export async function grantDevTicket(userId: string, gameType: string, db: Db) {
  const [ticket] = await db
    .insert(tables.minigameTickets)
    .values({
      userId,
      gameType,
      sourcePurchaseId: `dev-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: tables.minigameTickets.id });
  return ticket!;
}

// Production-safe counterpart to grantDevTicket - used by the secret QTE
// popup (qte.service.ts) to hand out a free random ticketed minigame play.
// Short expiry since it's only meant to be consumed by the very next
// start() call right after the user taps the popup.
export async function grantFreeTicket(
  userId: string,
  gameType: string,
  db: Db,
) {
  const [ticket] = await db
    .insert(tables.minigameTickets)
    .values({
      userId,
      gameType,
      sourcePurchaseId: `qte-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    })
    .returning({ id: tables.minigameTickets.id });
  return ticket!;
}

export async function listUnusedTickets(userId: string, db: Db) {
  // Preserve the value of legacy quiz tickets now that the unfinished quiz is
  // disabled. Puzzle is deterministic here so retries return a stable catalog.
  await db
    .update(tables.minigameTickets)
    .set({ gameType: "puzzle" })
    .where(
      and(
        eq(tables.minigameTickets.userId, userId),
        eq(tables.minigameTickets.gameType, "quiz"),
        eq(tables.minigameTickets.status, "unused"),
      ),
    );

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
        inArray(tables.minigameTickets.gameType, [...TICKETED_GAME_TYPES]),
        eq(tables.minigameTickets.status, "unused"),
        gt(tables.minigameTickets.expiresAt, new Date()),
      ),
    )
    .orderBy(tables.minigameTickets.createdAt);
}
