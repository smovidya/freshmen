import type { TeamMember } from './type';

const backgroundColors = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'];

export function getAvatarUrl(member: TeamMember) {
	const id = member.email.split('@')[0];
	const digitSum = id.split('').reduce((sum, digit) => sum + parseInt(digit), 0);

	const backgroundColor = backgroundColors[digitSum % backgroundColors.length];
	return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${id}&backgroundColor=${backgroundColor}`;
}
