import {
  ARCADE_GAME_TYPES,
  arcadeSubmitSchema,
  mysteryBoxOpenSchema,
  minigameStartSchema,
  precisionSubmitSchema,
  TICKETED_GAME_TYPES,
  turnstileQuerySchema,
  wheelClaimSchema,
  wheelPlaySchema,
} from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod/v4";
import type { Variables } from "../core";
import { requireGameOn } from "./game";
import * as precision from "../services/minigame/precision";
import * as wheel from "../services/minigame/wheel";
import * as mysteryBox from "../services/minigame/mystery-box";
import * as arcade from "../services/minigame/arcade";
import {
  grantDevTicket,
  listUnusedTickets,
} from "../services/minigame/tickets";
import { requireTurnstile } from "../turnstile-gate";

const devGrantTicketSchema = z.object({
  gameType: z.enum(TICKETED_GAME_TYPES),
});

const arcadeTypeParamSchema = z.object({
  type: z.enum(ARCADE_GAME_TYPES),
});

export const minigameRouter = new Hono<{ Variables: Variables }>()
  .get("/tickets", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await listUnusedTickets(user.id, c.get("db")));
  })
  // Dev toolbar only - lets developers jump straight into any ticketed
  // minigame while testing, without buying through the shop. Hard-blocked in
  // production regardless of who's asking.
  .post(
    "/dev/grant-ticket",
    requireGameOn,
    zValidator("json", devGrantTicketSchema),
    async (c) => {
      if (c.get("isProduction")) {
        return c.json({ error: "Not available in production" }, 403);
      }
      const user = c.get("user")!;
      const { gameType } = c.req.valid("json");
      await grantDevTicket(user.id, gameType, c.get("db"));
      return c.json({ ok: true });
    },
  )
  // requireTurnstile gates every credit-producing submit/claim/open below -
  // not the paired start/play calls, which award nothing on their own.
  .post(
    "/precision/start",
    requireGameOn,
    zValidator("json", minigameStartSchema),
    async (c) => {
      const user = c.get("user")!;
      const { playToken } = c.req.valid("json");
      return c.json(
        await precision.start({ userId: user.id, playToken }, c.get("db")),
      );
    },
  )
  .post(
    "/precision/submit",
    requireGameOn,
    zValidator("query", turnstileQuerySchema),
    requireTurnstile,
    zValidator("json", precisionSubmitSchema),
    async (c) => {
      const user = c.get("user")!;
      const body = c.req.valid("json");
      return c.json(
        await precision.submit(
          { userId: user.id, ouid: user.ouid!, ...body },
          c.get("db"),
        ),
      );
    },
  )
  .post(
    "/wheel/play",
    requireGameOn,
    zValidator("json", wheelPlaySchema),
    async (c) => {
      const user = c.get("user")!;
      const { playToken } = c.req.valid("json");
      return c.json(
        await wheel.play({ userId: user.id, playToken }, c.get("db")),
      );
    },
  )
  .post(
    "/wheel/claim",
    requireGameOn,
    zValidator("query", turnstileQuerySchema),
    requireTurnstile,
    zValidator("json", wheelClaimSchema),
    async (c) => {
      const user = c.get("user")!;
      const { playToken } = c.req.valid("json");
      return c.json(
        await wheel.claim(
          { userId: user.id, ouid: user.ouid!, playToken },
          c.get("db"),
        ),
      );
    },
  )
  // Fun-first arcade batch (see plan) - one generic route pair for all ten
  // game types instead of a bespoke pair each, mirroring arcade.ts's single
  // generic service. requireTurnstile gates submit only, same as the three
  // above (start awards nothing on its own).
  .post(
    "/arcade/:type/start",
    requireGameOn,
    zValidator("param", arcadeTypeParamSchema),
    zValidator("json", minigameStartSchema),
    async (c) => {
      const user = c.get("user")!;
      const { type } = c.req.valid("param");
      const { playToken } = c.req.valid("json");
      return c.json(
        await arcade.start(
          { userId: user.id, gameType: type, playToken },
          c.get("db"),
        ),
      );
    },
  )
  .post(
    "/arcade/:type/submit",
    requireGameOn,
    zValidator("param", arcadeTypeParamSchema),
    zValidator("query", turnstileQuerySchema),
    requireTurnstile,
    zValidator("json", arcadeSubmitSchema),
    async (c) => {
      const user = c.get("user")!;
      const { type } = c.req.valid("param");
      const { playToken, rawScore } = c.req.valid("json");
      return c.json(
        await arcade.submit(
          {
            userId: user.id,
            ouid: user.ouid!,
            gameType: type,
            playToken,
            rawScore,
          },
          c.get("db"),
        ),
      );
    },
  )
  .get("/mystery_box/status", requireGameOn, async (c) => {
    const user = c.get("user")!;
    return c.json(await mysteryBox.getStatus(user.id, c.get("db")));
  })
  .post(
    "/mystery_box/open",
    requireGameOn,
    zValidator("query", turnstileQuerySchema),
    requireTurnstile,
    zValidator("json", mysteryBoxOpenSchema),
    async (c) => {
      const user = c.get("user")!;
      const { playToken } = c.req.valid("json");
      return c.json(
        await mysteryBox.open(
          { userId: user.id, ouid: user.ouid!, playToken },
          c.get("db"),
        ),
      );
    },
  );
