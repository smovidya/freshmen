import { createStaffSchema } from "@vidyafreshmen/dto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAdmin, requireUser, type Variables } from "../core";
import {
  createStaff,
  deleteStaff,
  listStaffs,
} from "../services/staff.service";

export const staffRouter = new Hono<{ Variables: Variables }>()
  .get("/", requireUser, requireAdmin, async (c) => {
    return c.json(await listStaffs(c.get("db")));
  })
  .post(
    "/",
    requireUser,
    requireAdmin,
    zValidator("json", createStaffSchema),
    async (c) => {
      const staff = await createStaff(c.req.valid("json"), c.get("db"));
      return c.json(staff);
    },
  )
  .delete("/:id", requireUser, requireAdmin, async (c) => {
    const staff = await deleteStaff(c.req.param("id"), c.get("db"));
    return c.json(staff);
  });
