import type { AppRouter } from "@vidyafreshmen/trpc";

export type Student = NonNullable<Awaited<ReturnType<AppRouter["user"]["getStudentInfo"]>>>;
export type OwnedTeam = NonNullable<Awaited<ReturnType<AppRouter["team"]["getOwnedTeam"]>>>;
export type JoinedTeam = NonNullable<Awaited<ReturnType<AppRouter["team"]["getJoinedTeam"]>>>;
export type TeamMember = OwnedTeam["members"][number];

export type Group = {
  number: number,
  name: string,
  description?: string;
  link: string;
};
