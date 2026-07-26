import { eq } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { createMiddleware } from "hono/factory";
import type { Variables } from "./core";
import { verifyTurnstileToken } from "./turnstile";

// How long a verification stays usable across *any* gated action (pop
// bootstrap, ticket purchase, minigame submit) - long enough that a player
// actively playing never sees more than one challenge per sitting, short
// enough that a session that went stale can't be replayed indefinitely.
const TURNSTILE_VERIFICATION_TTL_MS = 10 * 60 * 1000;

async function recordTurnstileVerification(userId: string, db: Db): Promise<void> {
  await db
    .insert(tables.turnstileVerifications)
    .values({ userId, verifiedAt: new Date() })
    .onConflictDoUpdate({
      target: tables.turnstileVerifications.userId,
      set: { verifiedAt: new Date() },
    });
}

async function isRecentlyVerified(userId: string, db: Db): Promise<boolean> {
  const [row] = await db
    .select({ verifiedAt: tables.turnstileVerifications.verifiedAt })
    .from(tables.turnstileVerifications)
    .where(eq(tables.turnstileVerifications.userId, userId));
  if (!row) return false;
  return Date.now() - row.verifiedAt.getTime() < TURNSTILE_VERIFICATION_TTL_MS;
}

// Shared bot gate for score-earning actions beyond the pop path (ticket
// purchase, minigame submit): production-only, reuses a recent verification
// if one exists, otherwise verifies the turnstileToken query param (if any)
// and records it for reuse. Read directly off the raw query string (not via
// zValidator) since the value is opaque here - it's only ever forwarded to
// Cloudflare's siteverify, which rejects garbage on its own, so this stays a
// drop-in middleware that doesn't require every route to also wire up a
// query schema. Responds 403 with a machine-checkable `code` (not just a Thai
// message) so the client knows to solve a challenge and retry, rather than
// just showing a dead-end error.
export const requireTurnstile = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (!c.get("isProduction")) return next();

  const user = c.get("user")!;
  const db = c.get("db");
  const turnstileToken = c.req.query("turnstileToken");

  if (turnstileToken) {
    const ok = await verifyTurnstileToken({
      token: turnstileToken,
      secret: c.get("turnstileSecret"),
      remoteIp: c.req.header("cf-connecting-ip") ?? undefined,
    });
    if (ok) {
      await recordTurnstileVerification(user.id, db);
      return next();
    }
    return c.json({ error: "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", code: "turnstile_required" }, 403);
  }

  if (await isRecentlyVerified(user.id, db)) return next();

  return c.json({ error: "กรุณายืนยันตัวตนก่อนทำรายการนี้", code: "turnstile_required" }, 403);
});

export { recordTurnstileVerification };
