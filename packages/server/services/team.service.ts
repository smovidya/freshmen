import { eq, count } from "drizzle-orm";
import { tables, type Db, type Tx } from "@vidyafreshmen/db";
import { createRandomGroupNumberPreferenceOrder } from "./group.service";

export async function joinTeam(email: string, teamCode: string, db: Db | Tx) {
  // D1 does not support the BEGIN/COMMIT statements used by Drizzle's
  // transaction() implementation, so this runs as plain sequential queries.
  const [student] = await db
    .select({
      teamId: tables.students.teamId,
      teamOwnedId: tables.students.teamOwnedId
    })
    .from(tables.students)
    .where(eq(tables.students.email, email))
    .limit(1);

  if (!student) {
    return "user-not-found";
  }

  if (student.teamId) {
    return "already-in-team";
  }

  const teams = await db
    .select({
      id: tables.teams.id,
    })
    .from(tables.teams)
    .where(eq(tables.teams.teamCodes, teamCode))
    .limit(1);

  if (teams.length === 0) {
    return "team-not-founded";
  }

  const team = teams[0]!;

  if (student.teamOwnedId === team.id) {
    return "is-owner";
  }

  const ret = await db
    .select({ count: count() })
    .from(tables.students)
    .where(eq(tables.students.teamId, team.id));

  const currentMemberCount = ret[0]!.count;

  if (currentMemberCount >= 2) {
    return "team-full";
  }

  // Update the user's teamId
  await db
    .update(tables.students)
    .set({ teamId: team.id })
    .where(eq(tables.students.email, email));

  return "ok";
}

export async function regenerateTeamCode(ownerEmail: string, db: Db | Tx) {
  const teamCodes = await generateTeamCode(db);
  await db
    .update(tables.teams)
    .set({ teamCodes })
    .where(
      eq(
        tables.teams.id,
        db.select({ teamId: tables.students.teamOwnedId })
          .from(tables.students)
          .where(eq(tables.students.email, ownerEmail))
      )
    );
}

export async function generateTeamCode(db: Db | Tx): Promise<string> {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate 6-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Check if code already exists
    const existingTeam = await db
      .select({ id: tables.teams.id })
      .from(tables.teams)
      .where(eq(tables.teams.teamCodes, code))
      .limit(1);

    if (existingTeam.length === 0) {
      return code;
    }
  }

  throw new Error(`Failed to generate unique team code after ${maxAttempts} attempts`);
}

export async function getOwnedTeam(email: string, db: Db | Tx) {
  const result = await db
    .select({
      teamId: tables.students.teamOwnedId,
      groupNumberPreferenceOrder: tables.teams.groupNumberPreferenceOrder,
      resultGroupNumber: tables.teams.resultGroupNumber,
      teamCodes: tables.teams.teamCodes
    })
    .from(tables.students)
    .innerJoin(tables.teams, eq(tables.teams.id, tables.students.teamOwnedId))
    .where(eq(tables.students.email, email))
    .limit(1);

  if (result.length === 0) {
    return null; // User doesn't own any team
  }

  const team = result[0]!;

  if (!team.teamId) {
    return null; // User doesn't own any team
  }

  // Get all team members
  const members = await db
    .select({
      firstname: tables.students.firstName,
      lastName: tables.students.lastName,
      nickname: tables.students.nickname,
      department: tables.students.department,
      email: tables.students.email
    })
    .from(tables.students)
    .where(eq(tables.students.teamId, team.teamId));

  const [owner] = await db
    .select({
      firstname: tables.students.firstName,
      lastName: tables.students.lastName,
      nickname: tables.students.nickname,
      department: tables.students.department,
      email: tables.students.email
    })
    .from(tables.students)
    .where(eq(tables.students.teamOwnedId, team.teamId));

  return {
    id: team.teamId,
    owner: owner!,
    teamCodes: team.teamCodes,
    resultGroupNumber: team.resultGroupNumber,
    groupPreferenceOrder: team.groupNumberPreferenceOrder?.split(",").map(it => parseInt(it)) ?? createRandomGroupNumberPreferenceOrder(),
    members
  };
}

export async function getJoinedTeam(email: string, db: Db | Tx) {
  const result = await db
    .select({
      teamId: tables.students.teamId,
      groupNumberPreferenceOrder: tables.teams.groupNumberPreferenceOrder,
      resultGroupNumber: tables.teams.resultGroupNumber,
    })
    .from(tables.students)
    .innerJoin(tables.teams, eq(tables.teams.id, tables.students.teamId))
    .where(eq(tables.students.email, email))
    .limit(1);

  if (result.length === 0) {
    return null; // User hasn't joined any team
  }

  const team = result[0]!;

  if (!team.teamId) {
    return null; // User hasn't joined any team
  }

  // Get all team members
  const members = await db
    .select({
      firstname: tables.students.firstName,
      lastName: tables.students.lastName,
      nickname: tables.students.nickname,
      department: tables.students.department,
      email: tables.students.email
    })
    .from(tables.students)
    .where(eq(tables.students.teamId, team.teamId));

  const [owner] = await db
    .select({
      firstname: tables.students.firstName,
      lastName: tables.students.lastName,
      nickname: tables.students.nickname,
      department: tables.students.department,
      email: tables.students.email
    })
    .from(tables.students)
    .where(eq(tables.students.teamOwnedId, team.teamId));

  return {
    id: team.teamId,
    resultGroupNumber: team.resultGroupNumber,
    groupPreferenceOrder: team.groupNumberPreferenceOrder?.split(",").map(it => parseInt(it)) ?? [],
    owner: owner!,
    members
  };
}

export async function leaveJoinedTeam(email: string, db: Db | Tx) {
  // Check if user is actually in a team
  const [student] = await db
    .select({
      teamId: tables.students.teamId,
      teamOwnedId: tables.students.teamOwnedId
    })
    .from(tables.students)
    .where(eq(tables.students.email, email))
    .limit(1);

  if (!student || !student.teamId) {
    return "not-in-team";
  }

  // Remove user from team
  await db
    .update(tables.students)
    .set({ teamId: null })
    .where(eq(tables.students.email, email));

  return "ok";
}

export async function kickOwnedTeamMemeber(ownerEmail: string, targetEmail: string, db: Db | Tx) {
  // Get owner's team
  const [owner] = await db
    .select({
      teamOwnedId: tables.students.teamOwnedId
    })
    .from(tables.students)
    .where(eq(tables.students.email, ownerEmail))
    .limit(1);

  if (!owner || !owner.teamOwnedId) {
    return "not-team-owner";
  }

  // Check if target is in the owner's team
  const [target] = await db
    .select({
      teamId: tables.students.teamId,
      teamOwnedId: tables.students.teamOwnedId
    })
    .from(tables.students)
    .where(eq(tables.students.email, targetEmail))
    .limit(1);

  if (!target) {
    return "target-not-found";
  }

  if (target.teamId !== owner.teamOwnedId) {
    return "target-not-in-team";
  }

  // Remove target from team
  await db
    .update(tables.students)
    .set({ teamId: null })
    .where(eq(tables.students.email, targetEmail));

  return "ok";
}