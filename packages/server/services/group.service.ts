import { eq, and, like, or } from "drizzle-orm";
import { tables, type Db, type Tx } from "@vidyafreshmen/db";
import { availableGroups, user } from "@vidyafreshmen/db/schemas";
import type { groupPreferenceSchema, transferUserGroupSchema } from "@vidyafreshmen/dto";
import type z from "zod/v4";

export async function updateGroupPreference(email: string, preference: z.infer<typeof groupPreferenceSchema>, db: Db | Tx) {
  const preferenceString = preference.join(",");

  // Update the team's group preference using JOIN
  await db
    .update(tables.teams)
    .set({ groupNumberPreferenceOrder: preferenceString })
    .from(tables.students)
    .where(
      and(
        eq(tables.teams.id, tables.students.teamOwnedId),
        eq(tables.students.email, email)
      )
    );
}

export async function getGroupPreference(email: string, db: Db | Tx) {
  const result = await db
    .select({
      groupNumberPreferenceOrder: tables.teams.groupNumberPreferenceOrder
    })
    .from(tables.students)
    .innerJoin(tables.teams, eq(tables.teams.id, tables.students.teamOwnedId))
    .where(eq(tables.students.email, email))
    .limit(1);

  if (result.length === 0) {
    throw new Error('User or team not found');
  }

  const preferenceString = result[0]!.groupNumberPreferenceOrder;

  // Convert comma-separated string back to array
  return preferenceString ? preferenceString.split(",") : [];
}


export const GROUP_NUMBERS = [1, 3, 4, 5, 6, 7] as const;

export function createRandomGroupNumberPreferenceOrder() {
  const numbers: number[] = [...GROUP_NUMBERS];

  // Fisher-Yates shuffle algorithm
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j]!, numbers[i]!];
  }

  return numbers;
}

export type AdminGroup = {
  id: string;
  number: string;
  name: string;
  maxMembers: number;
  hasPassword: boolean;
};

// Never returns the actual password value - the admin UI is write-only for
// this field (type a new one, save), same shape as a credential-reset flow,
// so the current code never round-trips over the wire on page load.
export async function listGroupsForAdmin(db: Db): Promise<AdminGroup[]> {
  const rows = await db
    .select({
      id: availableGroups.id,
      number: availableGroups.number,
      name: availableGroups.name,
      maxMembers: availableGroups.maxMembers,
      joinGroupPassword: availableGroups.joinGroupPassword,
    })
    .from(availableGroups)
    .orderBy(availableGroups.number);

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    name: row.name,
    maxMembers: row.maxMembers,
    hasPassword: !!row.joinGroupPassword,
  }));
}

export type TransferSearchResult = {
  userId: string;
  name: string;
  email: string;
  ouid: string | null;
  role: string | null;
  // Current game/leaderboard affiliation (user.group) - null if never joined.
  groupNumber: string | null;
  nickname: string | null;
  hasStudentRecord: boolean;
  // Current onsite boeing assignment (student_group) - null for staff and
  // freshmen without one.
  boeing: { groupNumber: number; subgroupNumber: number } | null;
};

// Admin transfer tool: find anyone with an account by OUID, email, name, or
// student nickname. Matches are substring (LIKE) and capped at 20 - this
// backs a live search box, not a roster export.
export async function searchUsersForTransfer(query: string, db: Db): Promise<TransferSearchResult[]> {
  const pattern = `%${query.trim()}%`;

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      ouid: user.ouid,
      role: user.role,
      groupNumber: user.group,
      nickname: tables.students.nickname,
      studentId: tables.students.id,
      boeingGroupNumber: tables.studentGroup.groupNumber,
      boeingSubgroupNumber: tables.studentGroup.subgroupNumber,
    })
    .from(user)
    .leftJoin(tables.students, eq(tables.students.email, user.email))
    .leftJoin(tables.studentGroup, eq(tables.studentGroup.studentId, tables.students.id))
    .where(
      or(
        like(user.name, pattern),
        like(user.email, pattern),
        like(user.ouid, pattern),
        like(tables.students.nickname, pattern),
      ),
    )
    .limit(20);

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    ouid: row.ouid,
    role: row.role,
    groupNumber: row.groupNumber,
    nickname: row.nickname,
    hasStudentRecord: row.studentId != null,
    boeing:
      row.boeingGroupNumber != null && row.boeingSubgroupNumber != null
        ? { groupNumber: row.boeingGroupNumber, subgroupNumber: row.boeingSubgroupNumber }
        : null,
  }));
}

export type TransferResult = { ok: true; boeingUpdated: boolean };

// Moves a person to another group. Always updates user.group (what the game,
// leaderboards and scoreboard aggregate on - their points follow them
// automatically since totals are computed live from current membership).
// For numeric airline destinations it also moves the boeing (student_group)
// assignment when one exists (new subgroupNumber required) or creates one if
// a subgroupNumber was provided; staff pseudo-group destinations (e.g.
// "central-staff", a non-numeric number that can't fit student_group's
// integer column) leave any boeing row untouched.
export async function transferUserGroup(
  input: z.infer<typeof transferUserGroupSchema>,
  db: Db,
): Promise<TransferResult> {
  const target = await db.query.user.findFirst({ where: eq(user.id, input.userId) });
  if (!target) throw new Error("ไม่พบผู้ใช้นี้");

  const destination = await db.query.availableGroups.findFirst({
    where: eq(availableGroups.number, input.toGroupNumber),
  });
  if (!destination) throw new Error("ไม่พบกลุ่มปลายทาง");

  const isAirlineDestination = /^\d+$/.test(destination.number);
  let boeingUpdated = false;

  if (isAirlineDestination) {
    const [studentRow] = await db
      .select({ studentId: tables.students.id, boeingId: tables.studentGroup.id })
      .from(tables.students)
      .leftJoin(tables.studentGroup, eq(tables.studentGroup.studentId, tables.students.id))
      .where(eq(tables.students.email, target.email))
      .limit(1);

    if (studentRow?.boeingId) {
      if (input.subgroupNumber == null) {
        throw new Error("คนนี้มีโบอิ้งอยู่แล้ว ต้องระบุหมายเลขโบอิ้งใหม่ในสายการบินปลายทาง");
      }
      await db
        .update(tables.studentGroup)
        .set({ groupNumber: Number(destination.number), subgroupNumber: input.subgroupNumber })
        .where(eq(tables.studentGroup.id, studentRow.boeingId));
      boeingUpdated = true;
    } else if (studentRow && input.subgroupNumber != null) {
      await db.insert(tables.studentGroup).values({
        studentId: studentRow.studentId,
        ouid: target.ouid,
        groupNumber: Number(destination.number),
        subgroupNumber: input.subgroupNumber,
      });
      boeingUpdated = true;
    }
  }

  await db.update(user).set({ group: destination.number }).where(eq(user.id, input.userId));

  return { ok: true, boeingUpdated };
}

export async function updateGroupPassword(groupId: string, password: string, db: Db): Promise<void> {
  const updated = await db
    .update(availableGroups)
    .set({ joinGroupPassword: password })
    .where(eq(availableGroups.id, groupId))
    .returning({ id: availableGroups.id });

  if (updated.length === 0) {
    throw new Error("ไม่พบกลุ่มนี้");
  }
}

