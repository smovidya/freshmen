import {
  mysteryBoxOpenSchema,
  precisionSubmitSchema,
  puzzleSubmitSchema,
  quizSubmitSchema,
  wheelPlaySchema,
} from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Variables } from "../core";
import { requireGameOn } from "./game";
import * as puzzle from "../services/minigame/puzzle";
import * as precision from "../services/minigame/precision";
import * as wheel from "../services/minigame/wheel";
import * as quiz from "../services/minigame/quiz";
import * as mysteryBox from "../services/minigame/mystery-box";
import { listUnusedTickets } from "../services/minigame/tickets";

export const minigameRouter = new Hono<{ Variables: Variables }>()
  .get("/tickets", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await listUnusedTickets(user.id, c.get("db")));
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
