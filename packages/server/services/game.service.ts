import { eq, and } from "drizzle-orm";
import { tables, type Db, type Tx } from "@vidyafreshmen/db";
import type { groupPreferenceSchema } from "@vidyafreshmen/dto";
import type z from "zod/v4";
import { availableGroups, user } from '@vidyafreshmen/db/schemas';

export async function updateUserGroup(email: string, groupCode: string, db: Db | Tx) {
  const studentUser = await db.query.user.findFirst({
    where: eq(user?.email, email),
  })

  if (studentUser?.group) {
    throw new Error("คุณมีกลุ่มอยู่แล้ว");
  }

  const group = await db.query.availableGroups.findFirst({
    where: eq(availableGroups.joinGroupPassword, groupCode),
  })

  if (!group) {
    throw new Error("ไม่พบกลุ่มนี้")
  }

  await db
    .update(user)
    .set({
      group: group.number
    })
    .where(eq(user.email, email))
}
