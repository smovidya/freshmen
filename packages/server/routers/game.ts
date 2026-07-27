import { submitPopSchema, turnstileQuerySchema } from "@vidyafreshmen/dto";
import { winnerLeaderboardCutoff } from "@vidyafreshmen/flags";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAdmin, requireGameOn, requireStaff, requireUser, type Variables } from "../core";
import * as gameService from "../services/game.service";
import { verifyTurnstileToken } from "../turnstile";
import { recordTurnstileVerification } from "../turnstile-gate";
import { qteRouter } from "./qte";

// Re-exported for existing importers (routers/minigame.ts) - the middleware
// itself now lives in core.ts to avoid a circular import with routers/qte.ts.
export { requireGameOn };

export const gameRouter = new Hono<{ Variables: Variables }>()
  // Bot gate: bootstrapping a pop session requires a Turnstile pass in
  // production. Tokens chained through /pop responses stay Turnstile-free, so
  // an honest client verifies once per continuous session (and again after
  // the 5-min token TTL forces a re-bootstrap); a headless farm bot has to
  // solve a challenge every session. Staging/local skip - the widget/sitekey
  // only exist on the production domain (same gate as registration).
  .get("/pop-token", requireGameOn, zValidator("query", turnstileQuerySchema), async (c) => {
    const user = c.get("user")!;
    if (c.get("isProduction")) {
      const ok = await verifyTurnstileToken({
        token: c.req.valid("query").turnstileToken,
        secret: c.get("turnstileSecret"),
        remoteIp: c.req.header("cf-connecting-ip") ?? undefined,
      });
      if (!ok) {
        return c.json({ error: "ยืนยันตัวตนไม่สำเร็จ กรุณารีเฟรชหน้าเกม" }, 403);
      }
      // Also feeds requireTurnstile's shared "recently verified" state
      // (turnstile-gate.ts), so ticket purchases and minigame submits right
      // after a pop session bootstraps don't demand a second challenge.
      await recordTurnstileVerification(user.id, c.get("db"));
    }
    const { token, expiresAt } = await gameService.issuePopToken(user.id, c.get("db"));
    return c.json({ token, expiresAt });
  })
  .post("/pop", requireGameOn, zValidator("json", submitPopSchema), async (c) => {
    const user = c.get("user")!;
    const { pop, token } = c.req.valid("json");

    const { applied, nextToken } = await gameService.addPop(
      user.id,
      user.ouid!,
      pop,
      token,
      c.req.header("user-agent"),
      c.get("db"),
    );

    return c.json({ ok: true, applied, nextToken });
  })
  .get("/stats/self", requireGameOn, async (c) => {
    const user = c.get("user")!;
    const score = await gameService.getSelfScore(user.id, c.get("db"));
    return c.json(score);
  })
  .get("/leaderboard", requireGameOn, async (c) => {
    const user = c.get("user")!;
    // requireGameOn already guarantees user.group is set.
    const leaderboard = await gameService.getMyGroupLeaderboard(user.group!, c.get("db"), c.get("cache"));
    return c.json(leaderboard);
  })
  // Open to any signed-in user - powers the /scoreboard display (originally
  // staff-room-projector-only, now public within the app). Not
  // requireGameOn - the display must work outside the game-playing window
  // too. Path keeps the historical "-public" suffix so the RPC client key
  // stays stable.
  .get("/scoreboard-public", requireUser, async (c) => {
    const scoreboard = await gameService.getScoreboard(c.get("db"), c.get("cache"));
    return c.json(scoreboard);
  })
  // Scoreboard drill-down: top 10 players of one group, for the
  // click-to-expand rows on the /scoreboard display.
  .get("/scoreboard-top10/:groupNumber", requireUser, async (c) => {
    const top10 = await gameService.getGroupTop10ForAdmin(c.req.param("groupNumber"), c.get("db"), c.get("cache"));
    return c.json({ top10 });
  })
  // Staff-only. Only returns days whose cutoff has already passed - not
  // gated behind game-playing (staff need this outside that window too) and
  // deliberately never returns not-yet-revealed days' data at all, so there's
  // nothing for the client to accidentally leak before cutoff.
  .get("/daily-leaderboard", requireUser, requireStaff, async (c) => {
    const revealed = c.get("flags").getRevealedDailyLeaderboards();
    const db = c.get("db");

    const days = await Promise.all(
      revealed.map(async ({ date, cutoffAt }) => ({
        date,
        cutoffAt,
        groups: await gameService.getDailyTop10PerGroup(new Date(cutoffAt), db),
      })),
    );

    return c.json({ days });
  })
  // Staff-only final snapshot. Unlike the daily boards this cutoff is a
  // one-off "as of now" capture and never advances, so the winners stay fixed.
  .get("/winner-leaderboard", requireUser, requireStaff, async (c) => {
    const cutoffAt = new Date(winnerLeaderboardCutoff);
    const groups = await gameService.getWinnerTop10PerAirline(cutoffAt, c.get("db"));
    return c.json({ cutoffAt, groups });
  })
  // Admin-only anti-cheat report over anomaly_events (see game.service.ts's
  // logAnomaly) - summary rollup per user, plus a per-user recent-event feed.
  .get("/anomalies", requireUser, requireAdmin, async (c) => {
    return c.json(await gameService.getAnomalySummaries(c.get("db")));
  })
  .get("/anomalies/:userId", requireUser, requireAdmin, async (c) => {
    return c.json(await gameService.getUserAnomalyEvents(c.req.param("userId"), c.get("db")));
  })
  // Secret QTE popup - schedule/claim, see routers/qte.ts.
  .route("/qte", qteRouter);
