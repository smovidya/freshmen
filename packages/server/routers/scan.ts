import { registerWalkinSchema, scanInputSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireStaff, requireUser, type Variables } from "../core";
import { listCheckpoints, recordScan } from "../services/scan.service";
import { getOrCreateStaffForUser } from "../services/staff.service";
import { registerWalkin } from "../services/students.service";

export const scanRouter = new Hono<{ Variables: Variables }>()
  .get("/checkpoints", requireUser, requireStaff, async (c) => {
    return c.json(await listCheckpoints(c.get("db")));
  })
  .post("/", requireUser, requireStaff, zValidator("json", scanInputSchema), async (c) => {
    const user = c.get("user")!;
    const db = c.get("db");
    const staff = await getOrCreateStaffForUser(user, db);
    const result = await recordScan(c.req.valid("json"), staff.id, db);
    return c.json(result);
  })
  .post("/register-walkin", requireUser, requireStaff, zValidator("json", registerWalkinSchema), async (c) => {
    await registerWalkin(c.req.valid("json"), c.get("db"));
    return c.json({ ok: true });
  });
