import { and, count, eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { user } from "@vidyafreshmen/db/schemas";
import { FRIEND_CODE_LENGTH, MAX_FRIENDS_PER_BUCKET } from "@vidyafreshmen/dto";
import { creditPoints } from "./points.service";

// Crockford base32 minus ambiguous chars (0/O, 1/I/L) - easy to read/say
// aloud in person, never derived from ouid (not guessable/sequential).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const FRIEND_CODE_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

// Same-airline and cross-airline adds are two fully independent tracks - each
// has its own 10-slot cap on the adder's side, and its own 1-10 popularity
// ladder on the target's side (see rewardRank below). Cross-airline adds pay
// out 1.5x on top of this base value.
const REWARD_LADDER = [2000, 1700, 1400, 1000, 800, 600, 400, 300, 200, 100];

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FRIEND_CODE_LENGTH));
  let code = "";
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

async function assignNewCode(userId: string, db: Db): Promise<string> {
  // Collision probability is astronomically low at this population size
  // (32^7 codespace) - retry loop is a safety net, not an expected path.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await db.update(user).set({ friendCode: code, friendCodeUpdatedAt: new Date() }).where(eq(user.id, userId));
      return code;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Failed to generate friend code");
}

export async function ensureFriendCode(userId: string, db: Db): Promise<string> {
  const [row] = await db.select({ friendCode: user.friendCode }).from(user).where(eq(user.id, userId));
  if (row?.friendCode) return row.friendCode;
  return assignNewCode(userId, db);
}

export async function refreshFriendCode(userId: string, db: Db): Promise<{ code: string }> {
  const [row] = await db
    .select({ friendCodeUpdatedAt: user.friendCodeUpdatedAt })
    .from(user)
    .where(eq(user.id, userId));

  if (row?.friendCodeUpdatedAt) {
    const elapsedMs = Date.now() - row.friendCodeUpdatedAt.getTime();
    if (elapsedMs < FRIEND_CODE_REFRESH_COOLDOWN_MS) {
      const remainingSec = Math.ceil((FRIEND_CODE_REFRESH_COOLDOWN_MS - elapsedMs) / 1000);
      throw new Error(`กรุณารออีก ${remainingSec} วินาทีก่อนขอโค้ดใหม่`);
    }
  }

  const code = await assignNewCode(userId, db);
  return { code };
}

export async function addFriend(input: { adderUserId: string; adderOuid: string; code: string }, db: Db) {
  const [target] = await db
    .select({ id: user.id, group: user.group })
    .from(user)
    .where(eq(user.friendCode, input.code));

  if (!target) throw new Error("ไม่พบรหัสเพื่อนนี้");
  if (target.id === input.adderUserId) throw new Error("ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้");

  const [adder] = await db.select({ group: user.group }).from(user).where(eq(user.id, input.adderUserId));
  const sameGroup = Boolean(adder?.group) && adder!.group === target.group;

  // Count-then-insert has a small TOCTOU race under rapid double-submits from
  // the same user (could momentarily exceed 10 in a bucket or compute a
  // duplicate rank) - accepted, same low-stakes tolerance as elsewhere in
  // this feature; the (adderUserId, targetUserId) unique constraint below is
  // what actually matters (hard-blocks double-adding the same person).
  const [outgoingRow] = await db
    .select({ outgoingCount: count() })
    .from(tables.friendEdges)
    .where(and(eq(tables.friendEdges.adderUserId, input.adderUserId), eq(tables.friendEdges.sameGroup, sameGroup)));
  const outgoingCount = outgoingRow?.outgoingCount ?? 0;

  if (outgoingCount >= MAX_FRIENDS_PER_BUCKET) {
    throw new Error(
      sameGroup
        ? `คุณเพิ่มเพื่อนสายการบินเดียวกันครบ ${MAX_FRIENDS_PER_BUCKET} คนแล้ว`
        : `คุณเพิ่มเพื่อนต่างสายการบินครบ ${MAX_FRIENDS_PER_BUCKET} คนแล้ว`,
    );
  }

  // Rank is about the target's popularity within this same/different-group
  // bucket, not the adder's own count - how many people in this bucket
  // already added this same code before this add.
  const [incomingRow] = await db
    .select({ incomingCount: count() })
    .from(tables.friendEdges)
    .where(and(eq(tables.friendEdges.targetUserId, target.id), eq(tables.friendEdges.sameGroup, sameGroup)));
  const incomingCount = incomingRow?.incomingCount ?? 0;

  const rewardRank = Math.min(incomingCount + 1, REWARD_LADDER.length);
  const rewardPoints = Math.round(REWARD_LADDER[rewardRank - 1]! * (sameGroup ? 1 : 1.5));

  const inserted = await db
    .insert(tables.friendEdges)
    .values({
      adderUserId: input.adderUserId,
      targetUserId: target.id,
      sameGroup,
      rewardRank,
      rewardPoints,
    })
    .onConflictDoNothing({ target: [tables.friendEdges.adderUserId, tables.friendEdges.targetUserId] })
    .returning({ id: tables.friendEdges.id });

  if (inserted.length === 0) {
    // Already added before - no-op, no re-reward, no slot re-consumed.
    return { alreadyAdded: true as const };
  }

  await creditPoints(db, {
    userId: input.adderUserId,
    ouid: input.adderOuid,
    amount: rewardPoints,
    source: "friend_referral",
    refId: inserted[0]!.id,
  });

  return { alreadyAdded: false as const, rewardRank, rewardPoints, sameGroup };
}

export async function getSelf(userId: string, db: Db) {
  const code = await ensureFriendCode(userId, db);

  const edges = await db
    .select({
      targetName: user.name,
      sameGroup: tables.friendEdges.sameGroup,
      rewardRank: tables.friendEdges.rewardRank,
      rewardPoints: tables.friendEdges.rewardPoints,
      createdAt: tables.friendEdges.createdAt,
    })
    .from(tables.friendEdges)
    .innerJoin(user, eq(user.id, tables.friendEdges.targetUserId))
    .where(eq(tables.friendEdges.adderUserId, userId))
    .orderBy(tables.friendEdges.createdAt);

  const sameGroupUsed = edges.filter((e) => e.sameGroup).length;
  const differentGroupUsed = edges.length - sameGroupUsed;

  return {
    code,
    sameGroupUsed,
    sameGroupRemaining: MAX_FRIENDS_PER_BUCKET - sameGroupUsed,
    differentGroupUsed,
    differentGroupRemaining: MAX_FRIENDS_PER_BUCKET - differentGroupUsed,
    slotsUsed: edges.length,
    slotsRemaining: MAX_FRIENDS_PER_BUCKET * 2 - edges.length,
    friends: edges,
  };
}
