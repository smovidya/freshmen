import { tables, type Db } from "@vidyafreshmen/db";
import type { createStaffSchema } from "@vidyafreshmen/dto";
import { and, desc, eq, isNull } from "drizzle-orm";
import z from "zod/v4";

// Scan endpoints are gated on the better-auth `role` (staff/admin), which is
// separate from the `staffs` roster row scans get attributed to. Auto-create
// the roster row on first scan so staff don't need a manual roster entry
// before they can use the scanner.
export async function getOrCreateStaffForUser(
  authUser: { id: string; name: string; ouid?: string | null },
  db: Db,
) {
  const [existing] = await db
    .select()
    .from(tables.staffs)
    .where(and(eq(tables.staffs.userId, authUser.id), isNull(tables.staffs.deletedAt)));

  if (existing) {
    return existing;
  }

  const [staff] = await db
    .insert(tables.staffs)
    .values({
      studentId: authUser.ouid ?? authUser.id,
      name: authUser.name,
      staffRole: "staff",
      userId: authUser.id,
    })
    .returning();

  return staff!;
}

export async function listStaffs(db: Db) {
  return db
    .select()
    .from(tables.staffs)
    .where(isNull(tables.staffs.deletedAt))
    .orderBy(desc(tables.staffs.createdAt));
}

export async function createStaff(
  input: z.infer<typeof createStaffSchema>,
  db: Db,
) {
  const existing = await db
    .select({ id: tables.staffs.id })
    .from(tables.staffs)
    .where(
      and(
        eq(tables.staffs.studentId, input.studentId),
        isNull(tables.staffs.deletedAt),
      ),
    );

  if (existing.length > 0) {
    throw new Error("Staff with this student ID already exists");
  }

  const [staff] = await db
    .insert(tables.staffs)
    .values({
      studentId: input.studentId,
      name: input.name,
      nickname: input.nickname,
      staffRole: input.staffRole,
    })
    .returning();

  return staff;
}

export async function deleteStaff(id: string, db: Db) {
  const [staff] = await db
    .update(tables.staffs)
    .set({ deletedAt: new Date() })
    .where(and(eq(tables.staffs.id, id), isNull(tables.staffs.deletedAt)))
    .returning();

  if (!staff) {
    throw new Error("Staff not found");
  }

  return staff;
}
