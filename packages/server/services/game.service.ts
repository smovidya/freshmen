import {
  eq,
  and,
  isNotNull,
  isNull,
  gt,
  lte,
  ne,
  desc,
  sql,
} from "drizzle-orm";
import { tables, type Db, type Tx } from "@vidyafreshmen/db";
import type { groupPreferenceSchema } from "@vidyafreshmen/dto";
import type z from "zod/v4";
import { availableGroups, user } from "@vidyafreshmen/db/schemas";
import type { SimpleCache } from "../core";
import { creditPoints, getBalance } from "./points.service";

// Generous upper bound on physical human tap rate (two-thumb frantic
// tapping), expressed in points/second now that each tap is worth
// POINTS_PER_POP (dto/game.ts) instead of 1 - 15 taps/s x 10 points/tap, same
// physical-plausibility bound as before the economy rescale, just in the
// unit addPop actually deals in. Bounds accepted points by server-observed
// elapsed time since this user's last accepted pop, same idiom as
// minigame/precision.ts trusting only its own clock - a scripted/held-down
// request loop can't claim more than could plausibly have happened between
// requests, regardless of what the client batches and reports.
const MAX_TAPS_PER_SECOND = 150;

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
export async function logAnomaly(
  db: Db,
  input: { userId: string; type: string; detail?: unknown },
) {
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
//
// Single-active-client rule: issuing a token voids every other outstanding
// (unconsumed, unexpired) token this user holds, so exactly one token chain -
// one device/tab - is ever live. A second client's next flush fails token
// validation and forces a re-bootstrap (which in production costs a fresh
// Turnstile solve, and in turn kills the first client's chain) - two devices
// can only steal the session back and forth, never pop in parallel.
export async function issuePopToken(userId: string, db: Db) {
  const [row] = await db
    .insert(tables.popSessions)
    .values({ userId, expiresAt: new Date(Date.now() + POP_TOKEN_TTL_MS) })
    .returning({
      token: tables.popSessions.token,
      expiresAt: tables.popSessions.expiresAt,
    });

  await db
    .update(tables.popSessions)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(tables.popSessions.userId, userId),
        isNull(tables.popSessions.consumedAt),
        ne(tables.popSessions.token, row!.token),
      ),
    );

  return row!;
}

// Atomic conditional UPDATE is the whole validity gate (unused, unexpired,
// belongs to this user) - same idiom as minigame_plays.status. 0 rows back
// means the token was missing, already consumed (replay), expired, or
// someone else's - all treated identically as "invalid" to the caller so a
// scripted replay attempt learns nothing about which.
async function consumePopToken(
  userId: string,
  token: string,
  db: Db,
): Promise<boolean> {
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

// Shake gameplay requires a phone physically moving in someone's hand - a
// request whose User-Agent plainly identifies a desktop/laptop browser can't
// be a genuine tap, it's a script or a devtools console taped to /pop.
// Rejecting it with a visible error would teach the attacker exactly which
// header to spoof next, so this stays silent: treated identically to the
// existing "elapsed-time throttle allowed zero this tick" path below (fresh
// token, applied: 0, no error, no distinguishing signal in the response).
// Positive-match on desktop OS strings (not "absence of mobile markers") to
// keep the false-positive rate low - an unusual-but-genuine mobile UA that
// this doesn't recognize just falls through to the normal throttle instead
// of getting silently zeroed.
const DESKTOP_UA_PATTERN = /Windows NT|Macintosh|X11; Linux|CrOS/i;
const MOBILE_UA_PATTERN = /Mobi|Android|iPhone|iPad|iPod/i;

function looksLikeDesktopClient(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  return (
    DESKTOP_UA_PATTERN.test(userAgent) && !MOBILE_UA_PATTERN.test(userAgent)
  );
}

export type AddPopResult = { applied: number; nextToken: string };

// Unified with the shop/minigame/friends economy - there is only one score
// now (spendable points balance), not a separate raw pop count. Buffs,
// purchases, minigame wins and friend rewards all move the same number
// shown here and on the leaderboard below.
//
// Returns the amount actually credited (after the token check, the
// elapsed-time throttle, and creditPoints' own active-buff accounting) plus the
// next chained token, so the caller can tell the client the truth instead of
// it optimistically guessing and silently correcting later.
export async function addPop(
  userId: string,
  ouid: string,
  requestedAmount: number,
  token: string,
  userAgent: string | undefined | null,
  db: Db,
): Promise<AddPopResult> {
  const tokenValid = await consumePopToken(userId, token, db);
  if (!tokenValid) {
    await logAnomaly(db, {
      userId,
      type: "pop_token_invalid",
      detail: { token },
    });
    throw new Error("เซสชันหมดอายุ กรุณาลองใหม่อีกครั้ง");
  }

  if (looksLikeDesktopClient(userAgent)) {
    await logAnomaly(db, {
      userId,
      type: "pop_desktop_client",
      detail: { userAgent },
    });
    const { token: nextToken } = await issuePopToken(userId, db);
    return { applied: 0, nextToken };
  }

  const now = new Date();

  const [existing] = await db
    .select({ lastPopAt: tables.popRateLimits.lastPopAt })
    .from(tables.popRateLimits)
    .where(eq(tables.popRateLimits.userId, userId));

  const lastPopAt = existing?.lastPopAt ?? null;
  const elapsedMs = lastPopAt
    ? now.getTime() - lastPopAt.getTime()
    : Number.MAX_SAFE_INTEGER;
  const maxAllowed = Math.max(
    0,
    Math.ceil((elapsedMs / 1000) * MAX_TAPS_PER_SECOND),
  );
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
      setWhere: lastPopAt
        ? eq(tables.popRateLimits.lastPopAt, lastPopAt)
        : undefined,
    })
    .returning({ userId: tables.popRateLimits.userId });

  const { token: nextToken } = await issuePopToken(userId, db);

  if (updated.length === 0) {
    return { applied: 0, nextToken };
  }

  const applied = await creditPoints(db, {
    userId,
    ouid,
    amount: allowedAmount,
    source: "shake_pop",
  });
  return { applied, nextToken };
}

export async function getSelfScore(userId: string, db: Db | Tx) {
  return getBalance(userId, db as Db);
}

export type DisplayPlayer = {
  playerId: string;
  displayName: string;
  score: number;
};
export type CentralGroupTotal = {
  groupNumber: string;
  groupLabel: string;
  totalScore: number;
};
export type MyGroupLeaderboard = {
  ownGroup: { groupNumber: string; groupLabel: string; top10: DisplayPlayer[] };
  central: CentralGroupTotal[];
};

// Precedence: nickname + boeing code (freshman, checked in & boeing-assigned)
// > bare student nickname (freshman, not yet onsite-assigned a boeing) >
// staff nickname (staffs table) > user.name (final fallback - covers
// ELEVATED_OUID_LIST admins with no staffs row at all).
function resolveDisplayName(row: {
  userName: string;
  studentNickname: string | null;
  groupNumber: number | null;
  subgroupNumber: number | null;
  staffNickname: string | null;
}): string {
  if (
    row.studentNickname &&
    row.groupNumber != null &&
    row.subgroupNumber != null
  ) {
    return `${row.studentNickname}#${row.groupNumber}${String(row.subgroupNumber).padStart(2, "0")}`;
  }
  return row.studentNickname ?? row.staffNickname ?? row.userName;
}

// Own-group top10 and the central board are cached via the Workers Cache API
// (5s TTL, matching the leaderboard drawer's poll interval) - own-group
// keyed by groupNumber (identical for every member of that group, so
// sharing the cache across them is correct, not a privacy issue), central
// keyed globally (identical for everyone). With every open drawer polling
// every 5s, this bounds D1 reads to ~1 per group + 1 total per 5s window,
// regardless of how many drawers are open.
const LEADERBOARD_CACHE_TTL_SECONDS = 5;

async function cached<T>(
  cache: SimpleCache,
  cacheKeyUrl: string,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = await cache.match(cacheKeyUrl);
  if (hit) return hit.json();

  const value = await compute();
  const response = new Response(JSON.stringify(value), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `max-age=${LEADERBOARD_CACHE_TTL_SECONDS}`,
    },
  });
  await cache.put(cacheKeyUrl, response);
  return value;
}

async function computeOwnGroupTop10(
  groupNumber: string,
  db: Db,
): Promise<DisplayPlayer[]> {
  const rows = await db
    .select({
      playerId: user.id,
      userName: user.name,
      score: tables.pointsBalances.balance,
      studentNickname: tables.students.nickname,
      groupNumber: tables.studentGroup.groupNumber,
      subgroupNumber: tables.studentGroup.subgroupNumber,
      staffNickname: tables.staffs.nickname,
    })
    .from(tables.pointsBalances)
    .innerJoin(user, eq(user.id, tables.pointsBalances.userId))
    .leftJoin(tables.students, eq(tables.students.email, user.email))
    .leftJoin(
      tables.studentGroup,
      eq(tables.studentGroup.studentId, tables.students.id),
    )
    .leftJoin(tables.staffs, eq(tables.staffs.userId, user.id))
    .where(eq(user.group, groupNumber))
    .orderBy(desc(tables.pointsBalances.balance))
    .limit(10);

  return rows.map((row) => ({
    playerId: row.playerId,
    displayName: resolveDisplayName(row),
    score: row.score,
  }));
}

// LEFT JOIN from availableGroups (not starting from pointsBalances) so a
// group with zero scorers yet still shows up - e.g. the Central Staff group
// right after seeding, before anyone's joined/played.
async function computeCentralBoard(db: Db): Promise<CentralGroupTotal[]> {
  const totalScore = sql<number>`coalesce(sum(${tables.pointsBalances.balance}), 0)`;
  const rows = await db
    .select({
      groupNumber: availableGroups.number,
      groupLabel: availableGroups.name,
      totalScore: totalScore.as("totalScore"),
    })
    .from(availableGroups)
    .leftJoin(user, eq(user.group, availableGroups.number))
    .leftJoin(tables.pointsBalances, eq(tables.pointsBalances.userId, user.id))
    .groupBy(availableGroups.number)
    .orderBy(desc(totalScore));

  return rows.map((row) => ({
    groupNumber: row.groupNumber,
    groupLabel: row.groupLabel,
    totalScore: row.totalScore,
  }));
}

// The real airline numbers (mirrors packages/db/seed-available-groups.sql and
// apps/web/src/lib/groups.ts, the canonical airline list). Used directly for
// airline-only views (final winner board); the public projector scoreboard
// additionally ranks the "central-staff" pseudo-group alongside the airlines.
// Allowlisting (rather than blocklisting) keeps any other stray pseudo-group -
// e.g. the legacy "central" duplicate observed on staging - off both boards
// automatically.
const AIRLINE_GROUP_NUMBERS = new Set(["1", "3", "4", "5", "6", "7"]);
const PUBLIC_SCOREBOARD_GROUP_NUMBERS = new Set([
  ...AIRLINE_GROUP_NUMBERS,
  "central-staff",
]);

export type Scoreboard = { groups: CentralGroupTotal[] };

// Admin-only projector scoreboard (auth enforced in routers/game.ts) - reuses
// the same cached central-board computation and cache entry the authenticated
// leaderboard drawer already populates, so this adds no extra D1 load beyond
// what the drawer already causes.
export async function getScoreboard(
  db: Db,
  cache: SimpleCache,
): Promise<Scoreboard> {
  const central = await cached(
    cache,
    "https://internal.cache/game/leaderboard/central",
    () => computeCentralBoard(db),
  );
  return {
    groups: central.filter((g) =>
      PUBLIC_SCOREBOARD_GROUP_NUMBERS.has(g.groupNumber),
    ),
  };
}

// Admin scoreboard drill-down: top 10 of any group (auth enforced in
// routers/game.ts). Reuses the exact per-group cache entry the members' own
// leaderboard drawer populates, so the projector polling this adds no extra
// D1 load beyond one read per group per 5s TTL window.
export async function getGroupTop10ForAdmin(
  groupNumber: string,
  db: Db,
  cache: SimpleCache,
): Promise<DisplayPlayer[]> {
  return cached(
    cache,
    `https://internal.cache/game/leaderboard/group/${encodeURIComponent(groupNumber)}`,
    () => computeOwnGroupTop10(groupNumber, db),
  );
}

// Own-group top10 is scoped by a server-derived groupNumber only (never a
// client-supplied param) - the privacy boundary is the WHERE clause inside
// computeOwnGroupTop10 itself, not client-side filtering. The central board
// has no such restriction (aggregate totals only, not individual-privacy-
// sensitive).
export async function getMyGroupLeaderboard(
  groupNumber: string,
  db: Db,
  cache: SimpleCache,
): Promise<MyGroupLeaderboard> {
  const [top10, central] = await Promise.all([
    cached(
      cache,
      `https://internal.cache/game/leaderboard/group/${encodeURIComponent(groupNumber)}`,
      () => computeOwnGroupTop10(groupNumber, db),
    ),
    cached(cache, "https://internal.cache/game/leaderboard/central", () =>
      computeCentralBoard(db),
    ),
  ]);

  const ownGroupLabel =
    central.find((g) => g.groupNumber === groupNumber)?.groupLabel ??
    groupNumber;
  return {
    ownGroup: { groupNumber, groupLabel: ownGroupLabel, top10 },
    central,
  };
}

export type DailyTopPlayer = {
  playerId: string;
  playerName: string;
  nickname: string | null;
  department: string | null;
  // Boeing code ("<group><subgroup 2-digit>", e.g. "105") - null for players
  // without an onsite boeing assignment (staff, un-checked-in freshmen).
  boeingCode: string | null;
  ouid: string | null;
  groupNumber: string;
  score: number;
};

// Cumulative score as of an arbitrary point in time, summed straight from
// points_ledger (the append-only event log) rather than the materialized
// pointsBalances table (which only ever holds the *current* total) - so the
// staff-only daily cutoff leaderboard (packages/flags' dailyLeaderboardCutoffs)
// needs no separate snapshot job, since every credit is already timestamped.
export type DailyGroupTop10 = { groupNumber: string; top10: DailyTopPlayer[] };

// Top 10 *per group*, not global - one full per-user score scan (no LIMIT),
// bucketed in JS. Rows arrive score-descending, so the first 10 seen per
// group are that group's top 10. Staff-only and per-view, so the full scan
// is acceptable; don't wire this into anything polled.
export async function getDailyTop10PerGroup(
  cutoffAt: Date,
  db: Db | Tx,
): Promise<DailyGroupTop10[]> {
  const scoreSum = sql<number>`sum(${tables.pointsLedger.delta})`;

  const rows = await db
    .select({
      playerId: user.id,
      playerName: user.name,
      ouid: user.ouid,
      groupNumber: user.group,
      nickname: tables.students.nickname,
      department: tables.students.department,
      sgGroupNumber: tables.studentGroup.groupNumber,
      sgSubgroupNumber: tables.studentGroup.subgroupNumber,
      score: scoreSum.as("score"),
    })
    .from(tables.pointsLedger)
    .innerJoin(user, eq(user.id, tables.pointsLedger.userId))
    .leftJoin(tables.students, eq(tables.students.email, user.email))
    .leftJoin(
      tables.studentGroup,
      eq(tables.studentGroup.studentId, tables.students.id),
    )
    .where(
      and(isNotNull(user.group), lte(tables.pointsLedger.createdAt, cutoffAt)),
    )
    .groupBy(user.id)
    .orderBy(desc(scoreSum));

  const byGroup = new Map<string, DailyTopPlayer[]>();
  for (const row of rows) {
    const groupNumber = row.groupNumber!;
    const list = byGroup.get(groupNumber) ?? [];
    if (list.length < 10) {
      list.push({
        playerId: row.playerId,
        playerName: row.playerName,
        nickname: row.nickname,
        department: row.department,
        // Same format as boarding-pass.svelte's boingCode
        boeingCode:
          row.sgGroupNumber != null && row.sgSubgroupNumber != null
            ? `${row.sgGroupNumber}${String(row.sgSubgroupNumber).padStart(2, "0")}`
            : null,
        ouid: row.ouid,
        groupNumber,
        score: row.score,
      });
      byGroup.set(groupNumber, list);
    }
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([groupNumber, top10]) => ({ groupNumber, top10 }));
}

// Final winner view is airline-only: staff pseudo-groups may participate in
// gameplay but are not part of the festival competition.
export async function getWinnerTop10PerAirline(
  cutoffAt: Date,
  db: Db | Tx,
): Promise<DailyGroupTop10[]> {
  const groups = await getDailyTop10PerGroup(cutoffAt, db);
  return groups.filter((group) => AIRLINE_GROUP_NUMBERS.has(group.groupNumber));
}

export type AnomalyUserSummary = {
  userId: string;
  playerName: string;
  ouid: string | null;
  groupNumber: string | null;
  total: number;
  countsByType: Record<string, number>;
  lastAt: Date;
};

// Admin anti-cheat report: per-user rollup of anomaly_events (invalid/replayed
// pop tokens, rate clamps), worst offenders first. Aggregated per (user, type)
// in SQL, folded to one row per user in JS.
export async function getAnomalySummaries(
  db: Db,
): Promise<AnomalyUserSummary[]> {
  const eventCount = sql<number>`count(*)`;
  const lastAt = sql<number>`max(${tables.anomalyEvents.createdAt})`;
  const rows = await db
    .select({
      userId: tables.anomalyEvents.userId,
      type: tables.anomalyEvents.type,
      playerName: user.name,
      ouid: user.ouid,
      groupNumber: user.group,
      n: eventCount.as("n"),
      lastAt: lastAt.as("last_at"),
    })
    .from(tables.anomalyEvents)
    .innerJoin(user, eq(user.id, tables.anomalyEvents.userId))
    .groupBy(tables.anomalyEvents.userId, tables.anomalyEvents.type);

  const byUser = new Map<string, AnomalyUserSummary>();
  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? {
      userId: row.userId,
      playerName: row.playerName,
      ouid: row.ouid,
      groupNumber: row.groupNumber,
      total: 0,
      countsByType: {},
      lastAt: new Date(0),
    };
    entry.total += row.n;
    entry.countsByType[row.type] = row.n;
    // drizzle returns the raw integer (epoch seconds) for aggregated timestamp
    // columns - the column's { mode: "timestamp" } mapping doesn't apply
    // through max().
    const rowLastAt = new Date(Number(row.lastAt) * 1000);
    if (rowLastAt > entry.lastAt) entry.lastAt = rowLastAt;
    byUser.set(row.userId, entry);
  }

  return [...byUser.values()].sort((a, b) => b.total - a.total);
}

export type AnomalyEventRow = {
  id: string;
  type: string;
  detail: string | null;
  createdAt: Date;
};

export async function getUserAnomalyEvents(
  userId: string,
  db: Db,
): Promise<AnomalyEventRow[]> {
  return db
    .select({
      id: tables.anomalyEvents.id,
      type: tables.anomalyEvents.type,
      detail: tables.anomalyEvents.detail,
      createdAt: tables.anomalyEvents.createdAt,
    })
    .from(tables.anomalyEvents)
    .where(eq(tables.anomalyEvents.userId, userId))
    .orderBy(desc(tables.anomalyEvents.createdAt))
    .limit(100);
}

export async function updateUserGroup(
  email: string,
  groupCode: string,
  db: Db | Tx,
) {
  const studentUser = await db.query.user.findFirst({
    where: eq(user?.email, email),
  });

  if (studentUser?.group) {
    throw new Error("คุณมีกลุ่มอยู่แล้ว");
  }

  const group = await db.query.availableGroups.findFirst({
    where: eq(availableGroups.joinGroupPassword, groupCode),
  });

  if (!group) {
    throw new Error("ไม่พบกลุ่มนี้");
  }

  await db
    .update(user)
    .set({
      group: group.number,
    })
    .where(eq(user.email, email));
}
