import type { OwnedTeam, StudentInfo, JoinedTeam } from '@vidyafreshmen/server';

export type Student = StudentInfo;
export type { OwnedTeam, JoinedTeam };
export type TeamMember = OwnedTeam['members'][number];

export type Group = {
	number: number;
	name: string;
	description?: string;
	link: string;
};
