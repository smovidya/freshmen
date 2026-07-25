import { qteClaimSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireGameOn, type Variables } from "../core";
import * as qteService from "../services/qte.service";

// Mounted under gameRouter at /qte, so these resolve as
// POST /api/game/qte/schedule and POST /api/game/qte/claim.
export const qteRouter = new Hono<{ Variables: Variables }>()
  .post("/schedule", requireGameOn, async (c) => {
    if (!c.get("flags").isEnabled("game-bonus-rotation")) {
      return c.json({ error: "ไม่พบกิจกรรมพิเศษในขณะนี้" }, 403);
    }
    const user = c.get("user")!;
    const session = await qteService.scheduleQte(user.id, c.get("db"));
    return c.json(session);
  })
  .post("/claim", requireGameOn, zValidator("json", qteClaimSchema), async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("json");
    const result = await qteService.claimQte({ userId: user.id, sessionId: id }, c.get("db"));
    return c.json(result);
  });
