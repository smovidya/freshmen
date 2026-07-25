import { eq, and } from "drizzle-orm";
import { tables, type Db, type Tx } from "@vidyafreshmen/db";
import { availableGroups } from "@vidyafreshmen/db/schemas";
import type { groupPreferenceSchema } from "@vidyafreshmen/dto";
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

