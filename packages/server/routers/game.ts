import { submitPopSchema } from "@vidyafreshmen/dto";
import { winnerLeaderboardCutoff } from "@vidyafreshmen/flags";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAdmin, requireGameOn, requireStaff, requireUser, type Variables } from "../core";
import * as gameService from "../services/game.service";
import { qteRouter } from "./qte";

// Re-exported for existing importers (routers/minigame.ts) - the middleware
// itself now lives in core.ts to avoid a circular import with routers/qte.ts.
export { requireGameOn };

export const gameRouter = new Hono<{ Variables: Variables }>()
  .get("/pop-token", requireGameOn, async (c) => {
    const user = c.get("user")!;
    const { token, expiresAt } = await gameService.issuePopToken(user.id, c.get("db"));
    return c.json({ token, expiresAt });
  })
  .post("/pop", requireGameOn, zValidator("json", submitPopSchema), async (c) => {
    const user = c.get("user")!;
    const { pop, token } = c.req.valid("json");

    const { applied, nextToken } = await gameService.addPop(user.id, user.ouid!, pop, token, c.get("db"));

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
  // Admin-only: powers the staff-room projector /scoreboard display (the
  // projector machine is logged in as an admin). Not requireGameOn - the
  // display must work outside the game-playing window too. Path keeps the
  // historical "-public" suffix so the RPC client key stays stable.
  .get("/scoreboard-public", requireUser, requireAdmin, async (c) => {
    const scoreboard = await gameService.getScoreboard(c.get("db"), c.get("cache"));
    return c.json(scoreboard);
  })
  // Admin scoreboard drill-down: top 10 players of one group, for the
  // click-to-expand rows on the projector /scoreboard display.
  .get("/scoreboard-top10/:groupNumber", requireUser, requireAdmin, async (c) => {
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
