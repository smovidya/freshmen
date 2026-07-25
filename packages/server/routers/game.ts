import { submitPopSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireGameOn, requireStaff, requireUser, type Variables } from "../core";
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
  // Deliberately public - no requireUser/requireGameOn. Powers the big-screen
  // /scoreboard display, which has no session (a projector isn't logged in).
  // Only exposes per-house aggregate totals, the same numbers already visible
  // to every signed-in player via the central board above - no new privacy
  // surface, just an unauthenticated read of existing public-facing data.
  .get("/scoreboard-public", async (c) => {
    const scoreboard = await gameService.getPublicScoreboard(c.get("db"), c.get("cache"));
    return c.json(scoreboard);
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
        top10: await gameService.getDailyTop10(new Date(cutoffAt), db),
      })),
    );

    return c.json({ days });
  })
  // Secret QTE popup - schedule/claim, see routers/qte.ts.
  .route("/qte", qteRouter);
