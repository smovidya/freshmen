import { addFriendSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Variables } from "../core";
import { requireGameOn } from "./game";
import * as friendsService from "../services/friends.service";

export const friendsRouter = new Hono<{ Variables: Variables }>()
  .get("/self", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await friendsService.getSelf(user.id, c.get("db")));
  })
  .post("/code/refresh", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await friendsService.refreshFriendCode(user.id, c.get("db")));
  })
  .post("/add", requireGameOn, zValidator("json", addFriendSchema), async (c) => {
    const user = c.get("user")!;
    const { code } = c.req.valid("json");
    const result = await friendsService.addFriend(
      { adderUserId: user.id, adderOuid: user.ouid!, code },
      c.get("db"),
    );
    return c.json(result);
  });
