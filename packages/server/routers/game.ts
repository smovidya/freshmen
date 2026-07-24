import { submitPopSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireStaff, requireUser, type Variables } from "../core";
import * as gameService from "../services/game.service";
import { createMiddleware } from "hono/factory";

export const requireGameOn = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: "You must be signed in to perform this action." },
        401,
      );
    }
    // Staff/admin can exercise gameplay endpoints regardless of the
    // game-playing window - lets festival staff test/support the game before
    // (or between) the real freshmen-facing window, without opening it early
    // for everyone else.
    const isStaffOrAdmin = user.role === "staff" || user.role === "admin";
    if (!isStaffOrAdmin && !c.get("flags").isEnabled("game-playing")) {
      return c.json({ error: "เกมไม่เปิดให้เล่นในขณะนี้" }, 403);
    }
    if (!user.group) {
      return c.json({ error: "กรุณาเข้าร่วมกลุ่มก่อนเล่นเกม" }, 400);
    }
    await next();
  },
);

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
  .get("/stats", requireGameOn, async (c) => {
    const leaderboard = await gameService.getLeaderboard(c.get("db"));
    return c.body(JSON.stringify(leaderboard), 200, {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=5",
    });
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
  });
