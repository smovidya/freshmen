import {
  mysteryBoxOpenSchema,
  precisionSubmitSchema,
  puzzleSubmitSchema,
  quizSubmitSchema,
  TICKETED_GAME_TYPES,
  wheelPlaySchema,
} from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod/v4";
import type { Variables } from "../core";
import { requireGameOn } from "./game";
import * as puzzle from "../services/minigame/puzzle";
import * as precision from "../services/minigame/precision";
import * as wheel from "../services/minigame/wheel";
import * as quiz from "../services/minigame/quiz";
import * as mysteryBox from "../services/minigame/mystery-box";
import { grantDevTicket, listUnusedTickets } from "../services/minigame/tickets";

const devGrantTicketSchema = z.object({ gameType: z.enum(TICKETED_GAME_TYPES) });

export const minigameRouter = new Hono<{ Variables: Variables }>()
  .get("/tickets", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await listUnusedTickets(user.id, c.get("db")));
  })
  // Dev toolbar only - lets developers jump straight into any ticketed
  // minigame while testing, without buying through the shop. Hard-blocked in
  // production regardless of who's asking.
  .post("/dev/grant-ticket", requireGameOn, zValidator("json", devGrantTicketSchema), async (c) => {
    if (c.get("isProduction")) {
      return c.json({ error: "Not available in production" }, 403);
    }
    const user = c.get("user")!;
    const { gameType } = c.req.valid("json");
    await grantDevTicket(user.id, gameType, c.get("db"));
    return c.json({ ok: true });
  })
  .post("/puzzle/start", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await puzzle.start(user.id, c.get("db")));
  })
  .post("/puzzle/submit", requireGameOn, zValidator("json", puzzleSubmitSchema), async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    return c.json(await puzzle.submit({ userId: user.id, ouid: user.ouid!, ...body }, c.get("db")));
  })
  .post("/precision/start", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await precision.start(user.id, c.get("db")));
  })
  .post("/precision/submit", requireGameOn, zValidator("json", precisionSubmitSchema), async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    return c.json(await precision.submit({ userId: user.id, ouid: user.ouid!, ...body }, c.get("db")));
  })
  .post("/wheel/play", requireGameOn, zValidator("json", wheelPlaySchema), async (c) => {
    const user = c.get("user")!;
    return c.json(await wheel.play({ userId: user.id, ouid: user.ouid! }, c.get("db")));
  })
  .post("/quiz/start", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await quiz.start(user.id, c.get("db")));
  })
  .post("/quiz/submit", requireGameOn, zValidator("json", quizSubmitSchema), async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    return c.json(await quiz.submit({ userId: user.id, ouid: user.ouid!, ...body }, c.get("db")));
  })
  .post("/mystery_box/open", requireGameOn, zValidator("json", mysteryBoxOpenSchema), async (c) => {
    const user = c.get("user")!;
    return c.json(await mysteryBox.open({ userId: user.id, ouid: user.ouid! }, c.get("db")));
  });
