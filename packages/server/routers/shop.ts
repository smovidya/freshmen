import { redeemBuffSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Variables } from "../core";
import { requireGameOn } from "./game";
import * as shopService from "../services/shop.service";

export const shopRouter = new Hono<{ Variables: Variables }>()
  .get("/catalog", requireGameOn, (c) => {
    return c.body(JSON.stringify(shopService.getCatalog()), 200, {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=5",
    });
  })
  .post("/buff", requireGameOn, zValidator("json", redeemBuffSchema), async (c) => {
    const user = c.get("user")!;
    const { item } = c.req.valid("json");
    const result = await shopService.buyBuff(
      { userId: user.id, ouid: user.ouid!, item },
      c.get("db"),
    );
    return c.json(result);
  })
  .post("/ticket", requireGameOn, async (c) => {
    const user = c.get("user")!;
    const result = await shopService.buyTicket({ userId: user.id, ouid: user.ouid! }, c.get("db"));
    return c.json(result);
  });
