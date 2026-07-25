import { updateGroupPasswordSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAdmin, requireUser, type Variables } from "../core";
import { listGroupsForAdmin, updateGroupPassword } from "../services/group.service";

// Admin-only: lets staff-admins rotate a group's (including the Central
// Staff pseudo-group's) join code without touching SQL directly - see
// packages/db/seed-central-staff-group.sql's comment, which this replaces
// as the rotation mechanism.
export const groupsRouter = new Hono<{ Variables: Variables }>()
  .get("/", requireUser, requireAdmin, async (c) => {
    return c.json(await listGroupsForAdmin(c.get("db")));
  })
  .put("/:id/password", requireUser, requireAdmin, zValidator("json", updateGroupPasswordSchema), async (c) => {
    const { password } = c.req.valid("json");
    await updateGroupPassword(c.req.param("id"), password, c.get("db"));
    return c.json({ ok: true });
  });
