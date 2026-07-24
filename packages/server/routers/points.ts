import { Hono } from "hono";
import { type Variables } from "../core";
import { requireGameOn } from "./game";
import * as pointsService from "../services/points.service";

export const pointsRouter = new Hono<{ Variables: Variables }>()
  .get("/self", requireGameOn, async (c) => {
    const user = c.get("user")!;
    const db = c.get("db");
    const [balance, activeBuff] = await Promise.all([
      pointsService.getBalance(user.id, db),
      pointsService.getActiveBuff(user.id, db),
    ]);
    return c.json({ balance, activeBuff });
  })
  .get("/claim", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await pointsService.getClaimStatus(user.id, c.get("db")));
  })
  .post("/claim", requireGameOn, async (c) => {
    const user = c.get("user")!;
    const result = await pointsService.claimFreePoints(
      { userId: user.id, ouid: user.ouid! },
      c.get("db"),
    );
    return c.json(result);
  })
  .get("/milestones/pending", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await pointsService.claimPendingMilestones(user.id, c.get("db")));
  });
