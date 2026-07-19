import { tables, type Db, type Tx } from "@vidyafreshmen/db";
import type { registrationSchema } from "@vidyafreshmen/dto";
import { eq } from "drizzle-orm";
import z from "zod/v4";
import { createRandomGroupNumberPreferenceOrder } from "./group.service";
import { generateTeamCode } from "./team.service";


export async function isRegistered(email: string, db: Db | Tx) {
  const existed = await db
    .select({ id: tables.students.id })
    .from(tables.students)
    .where(eq(tables.students.email, email));

  return existed.length !== 0;
}

export async function updateStudentInfo(input: z.infer<typeof registrationSchema>, email: string, db: Db | Tx) {
  const [updatedStudent] = await db
    .update(tables.students)
    .set({
      department: input.department,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelationship: input.emergencyContactRelationship,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      title: input.title,
      dragAllergies: input.drugAllergies,
      foodAllergies: input.foodAllergies,
      foodLimitations: input.foodLimitations,
      medicalConditions: input.medicalConditions,
      nickname: input.nickname,
    })
    .where(eq(tables.students.email, email))
    .returning();

  if (!updatedStudent) {
    throw new Error('Student not found or update failed');
  }

  return updatedStudent;
}

export async function createStudentWithTeam(input: z.infer<typeof registrationSchema>, email: string, db: Db) {
  const studentId = email.split("@")[0]!;

  // Check if student already exists
  if (await isRegistered(email, db)) {
    throw new Error('Student is already registered');
  }

  // D1 does not support the BEGIN/COMMIT statements used by Drizzle's
  // transaction() implementation. Generate both IDs up front so the related
  // rows can be written atomically with D1's batch API.
  const teamId = crypto.randomUUID();
  const id = crypto.randomUUID();
  const teamCode = await generateTeamCode(db);
  const team = {
    id: teamId,
    creatorId: id,
    groupNumberPreferenceOrder: createRandomGroupNumberPreferenceOrder().join(','),
    teamCodes: teamCode,
  };
  const student = {
    id,
    department: input.department,
    email,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    emergencyContactRelationship: input.emergencyContactRelationship,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    studentId,
    title: input.title,
    dragAllergies: input.drugAllergies,
    foodAllergies: input.foodAllergies,
    foodLimitations: input.foodLimitations,
    medicalConditions: input.medicalConditions,
    nickname: input.nickname,
    teamOwnedId: teamId,
  };

  await db.batch([
    db.insert(tables.teams).values(team),
    db.insert(tables.students).values(student),
  ]);

  return { student, team };
}

export async function getStudentByEmail(email: string, db: Db | Tx) {
  tables.students.dragAllergies;
  const student = await db
    .select({
      title: tables.students.title,
      firstName: tables.students.firstName,
      lastName: tables.students.lastName,
      nickname: tables.students.nickname,
      phone: tables.students.phone,
      department: tables.students.department,
      drugAllergies: tables.students.dragAllergies,
      emergencyContactName: tables.students.emergencyContactName,
      emergencyContactPhone: tables.students.emergencyContactPhone,
      emergencyContactRelationship: tables.students.emergencyContactRelationship,
      foodAllergies: tables.students.foodAllergies,
      foodLimitations: tables.students.foodLimitations,
      medicalConditions: tables.students.medicalConditions,
    })
    .from(tables.students)
    .where(eq(tables.students.email, email))
    .limit(1);

  if (student.length === 0) {
    return null;
  }

  return student[0];
}
