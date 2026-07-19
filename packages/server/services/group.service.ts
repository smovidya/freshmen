import { eq, and } from "drizzle-orm";
import { tables, type Db, type Tx } from "@vidyafreshmen/db";
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


export function createRandomGroupNumberPreferenceOrder() {
  const numbers = [1, 3, 4, 5, 6, 7];

  // Fisher-Yates shuffle algorithm
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j]!, numbers[i]!];
  }

  return numbers;
}

