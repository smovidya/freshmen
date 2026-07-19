import type { getJoinedTeam, getOwnedTeam } from './services/team.service';
import type { getStudentByEmail } from './services/students.service';

export type StudentInfo = NonNullable<Awaited<ReturnType<typeof getStudentByEmail>>>;
export type OwnedTeam = NonNullable<Awaited<ReturnType<typeof getOwnedTeam>>>;
export type JoinedTeam = NonNullable<Awaited<ReturnType<typeof getJoinedTeam>>>;
