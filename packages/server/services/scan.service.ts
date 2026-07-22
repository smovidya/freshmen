import { tables, type Db } from "@vidyafreshmen/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { GROUP_NUMBERS } from "./group.service";

const SUBGROUP_COUNT = 12;

export async function listCheckpoints(db: Db) {
  return db
    .select({
      id: tables.checkpoints.id,
      name: tables.checkpoints.name,
      checkpointType: tables.checkpoints.checkpointType,
      activityId: tables.checkpoints.activityId,
    })
    .from(tables.checkpoints)
    .where(isNull(tables.checkpoints.deletedAt));
}

// A student's "effective" team for group purposes is the team they joined,
// or their own owned team if they never joined anyone else's (every student
// gets an owned team at registration, even solo ones).
function effectiveTeamId(student: { teamId: string | null; teamOwnedId: string }) {
  return student.teamId ?? student.teamOwnedId;
}

async function pickLeastAssignedGroup(checkpointId: string, db: Db) {
  const rows = await db
    .select({
      groupNumber: tables.availableGroups.number,
      count: sql<number>`count(distinct ${tables.students.id})`,
    })
    .from(tables.scans)
    .innerJoin(tables.students, eq(tables.students.id, tables.scans.studentId))
    .innerJoin(
      tables.teams,
      sql`${tables.teams.id} = coalesce(${tables.students.teamId}, ${tables.students.teamOwnedId})`,
    )
    .innerJoin(tables.availableGroups, eq(tables.availableGroups.id, tables.teams.resultGroupNumber))
    .where(eq(tables.scans.checkpointId, checkpointId))
    .groupBy(tables.availableGroups.number);

  const counts = new Map<number, number>(GROUP_NUMBERS.map((n) => [n, 0]));
  for (const row of rows) {
    counts.set(Number(row.groupNumber), row.count);
  }

  let best: number = GROUP_NUMBERS[0];
  for (const n of GROUP_NUMBERS) {
    if (counts.get(n)! < counts.get(best)!) best = n;
  }
  return best;
}

export async function assignOnsiteGroupIfMissing(studentDbId: string, checkpointId: string, db: Db) {
  const [student] = await db
    .select({ teamId: tables.students.teamId, teamOwnedId: tables.students.teamOwnedId })
    .from(tables.students)
    .where(eq(tables.students.id, studentDbId));

  if (!student) throw new Error("Student not found");

  const teamId = effectiveTeamId(student);

  const [team] = await db
    .select({ resultGroupNumber: tables.teams.resultGroupNumber })
    .from(tables.teams)
    .where(eq(tables.teams.id, teamId));

  if (team?.resultGroupNumber) {
    const [group] = await db
      .select({ number: tables.availableGroups.number })
      .from(tables.availableGroups)
      .where(eq(tables.availableGroups.id, team.resultGroupNumber));
    return group!.number;
  }

  const chosenNumber = await pickLeastAssignedGroup(checkpointId, db);
  const [group] = await db
    .select({ id: tables.availableGroups.id, number: tables.availableGroups.number })
    .from(tables.availableGroups)
    .where(eq(tables.availableGroups.number, String(chosenNumber)));

  if (!group) throw new Error(`No available group configured for number ${chosenNumber}`);

  await db.update(tables.teams).set({ resultGroupNumber: group.id }).where(eq(tables.teams.id, teamId));

  return group.number;
}

async function pickLeastAssignedSubgroup(groupNumber: number, checkpointId: string, db: Db) {
  const rows = await db
    .select({
      subgroupNumber: tables.studentGroup.subgroupNumber,
      count: sql<number>`count(*)`,
    })
    .from(tables.studentGroup)
    .innerJoin(tables.scans, eq(tables.scans.studentId, tables.studentGroup.studentId))
    .where(and(eq(tables.scans.checkpointId, checkpointId), eq(tables.studentGroup.groupNumber, groupNumber)))
    .groupBy(tables.studentGroup.subgroupNumber);

  const counts = new Map<number, number>();
  for (let i = 1; i <= SUBGROUP_COUNT; i++) counts.set(i, 0);
  for (const row of rows) counts.set(row.subgroupNumber, row.count);

  let best = 1;
  for (let i = 1; i <= SUBGROUP_COUNT; i++) {
    if (counts.get(i)! < counts.get(best)!) best = i;
  }
  return best;
}

export async function assignOnsiteBoingIfMissing(
  studentDbId: string,
  groupNumber: number,
  checkpointId: string,
  db: Db,
) {
  const [existing] = await db
    .select({ subgroupNumber: tables.studentGroup.subgroupNumber })
    .from(tables.studentGroup)
    .where(eq(tables.studentGroup.studentId, studentDbId));

  if (existing) return existing.subgroupNumber;

  const chosen = await pickLeastAssignedSubgroup(groupNumber, checkpointId, db);
  await db.insert(tables.studentGroup).values({
    studentId: studentDbId,
    groupNumber,
    subgroupNumber: chosen,
  });

  return chosen;
}

export type ScanResult =
  | { status: "not-registered"; studentIdentifier: string }
  | {
      status: "checked-in" | "already-checked-in";
      student: {
        firstName: string;
        lastName: string;
        nickname: string | null;
        department: string;
        studentId: string;
      };
      groupNumber: number;
      subgroupNumber: number;
    };

export async function recordScan(
  input: { studentIdentifier: string; checkpointId: string },
  staffId: string,
  db: Db,
): Promise<ScanResult> {
  const [checkpoint] = await db
    .select({ id: tables.checkpoints.id, activityId: tables.checkpoints.activityId })
    .from(tables.checkpoints)
    .where(eq(tables.checkpoints.id, input.checkpointId));

  if (!checkpoint) throw new Error("Checkpoint not found");

  const [student] = await db
    .select()
    .from(tables.students)
    .where(eq(tables.students.studentId, input.studentIdentifier));

  if (!student) {
    return { status: "not-registered", studentIdentifier: input.studentIdentifier };
  }

  const inserted = await db
    .insert(tables.scans)
    .values({
      studentId: student.id,
      activityId: checkpoint.activityId,
      staffId,
      checkpointId: checkpoint.id,
    })
    .onConflictDoNothing({ target: [tables.scans.studentId, tables.scans.checkpointId] })
    .returning();

  const alreadyCheckedIn = inserted.length === 0;

  const groupNumber = await assignOnsiteGroupIfMissing(student.id, checkpoint.id, db);
  const subgroupNumber = await assignOnsiteBoingIfMissing(student.id, Number(groupNumber), checkpoint.id, db);

  return {
    status: alreadyCheckedIn ? "already-checked-in" : "checked-in",
    student: {
      firstName: student.firstName,
      lastName: student.lastName,
      nickname: student.nickname,
      department: student.department,
      studentId: student.studentId,
    },
    groupNumber: Number(groupNumber),
    subgroupNumber,
  };
}
